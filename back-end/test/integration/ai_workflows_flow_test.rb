require "test_helper"

class AiWorkflowsFlowTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @user = users(:one)
    @other_user = users(:two)
    clear_enqueued_jobs
    clear_performed_jobs
  end

  teardown do
    clear_enqueued_jobs
    clear_performed_jobs
  end

  test "returns the current user's AI readiness status" do
    get "/ai/status", headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "openrouter", response_json["provider"]
    assert response_json.key?("model_reference")
    assert response_json.key?("image_processing")
  end

  test "creates and fetches a user-owned workflow with its stages" do
    post ai_workflows_url, params: {
      ai_workflow: {
        kind: "modeled_item",
        requested_count: 1,
        metadata: { source: "item-detail" }
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :accepted
    workflow_id = response_json.fetch("id")
    assert_equal "modeled_item", response_json["kind"]
    assert_equal %w[prepare modeled verify], response_json.fetch("stages").map { |stage| stage.fetch("key") }

    get ai_workflow_url(workflow_id), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal workflow_id, response_json["id"]
    assert_equal "item-detail", response_json.dig("metadata", "source")
  end

  test "does not expose another user's workflow" do
    workflow = @other_user.ai_workflows.create!(kind: "item_clean")

    get ai_workflow_url(workflow), headers: auth_headers(@user), as: :json

    assert_response :not_found
  end

  test "cancels a pending workflow" do
    workflow = @user.ai_workflows.create!(kind: "lookbook", requested_count: 3)
    workflow.initialize_stages!

    post cancel_ai_workflow_url(workflow), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "cancelled", response_json["status"]
    assert_not_nil response_json["completed_at"]
    assert response_json.fetch("stages").all? { |stage| stage.fetch("status") == "cancelled" }
  end

  test "discards a modeled outfit response when generation is cancelled in flight" do
    outfit = outfits(:one)
    outfit.clothing_items.each { |item| item.photo.attach(item_photo_upload) }
    attach_model_references(@user, count: 2)

    workflow_id = nil
    with_modeled_cleaner_stub(on_generate: -> { AiWorkflow.find(workflow_id).cancel! }) do
      post generate_modeled_image_outfit_url(outfit), headers: auth_headers(@user), as: :json
      assert_response :accepted
      workflow_id = response_json.fetch("id")

      perform_enqueued_jobs only: ModeledOutfitGenerationJob
    end

    workflow = AiWorkflow.find(workflow_id)
    artifact = workflow.artifacts.first
    assert workflow.cancelled?
    assert_equal "cancelled", artifact.status
    assert_not artifact.file.attached?
  end

  test "requires a private model reference before queueing a modeled preview" do
    post generate_modeled_image_clothing_item_url(clothing_items(:one)), headers: auth_headers(@user), as: :json

    assert_response :unprocessable_content
    assert_includes response_json["error"], "private model reference"
    assert_no_enqueued_jobs
  end

  test "queues and completes a modeled item workflow" do
    item = clothing_items(:one)
    item.photo.attach(item_photo_upload)
    attach_model_references(@user, count: 2)

    workflow_id = nil
    captured_request = {}
    with_modeled_cleaner_stub(capture: captured_request) do
      assert_enqueued_with(job: ModeledImageGenerationJob) do
        post generate_modeled_image_clothing_item_url(item), headers: auth_headers(@user), as: :json
      end

      assert_response :accepted
      workflow_id = response_json.fetch("id")
      assert_equal "modeled_item", response_json["kind"]
      assert_equal %w[prepare modeled verify], response_json.fetch("stages").map { |stage| stage.fetch("key") }

      perform_enqueued_jobs only: ModeledImageGenerationJob

      get ai_workflow_url(workflow_id), headers: auth_headers(@user), as: :json
    end

    assert_response :success
    assert_equal "succeeded", response_json["status"]
    assert response_json.fetch("stages").all? { |stage| stage.fetch("status") == "approved" }
    assert response_json.fetch("stages").all? { |stage| stage["decision"].nil? }
    artifact = response_json.fetch("stages").flat_map { |stage| stage.fetch("artifacts") }.first
    assert_equal "modeled_image", artifact["kind"]
    assert_equal "approved", artifact["status"]
    assert_equal "automatic", artifact.dig("diagnostics", "publication")
    assert_match %r{/rails/active_storage/blobs/proxy/}, artifact["file_url"]
    assert_equal 2, captured_request.fetch(:reference_photos).length

    patch preview_ai_workflow_url(workflow_id), params: {
      modeled_preview: { photo: item_photo_upload }
    }, headers: auth_headers(@user)

    assert_response :success
    edited_artifact = response_json.fetch("stages").flat_map { |stage| stage.fetch("artifacts") }.first
    assert_equal "approved", edited_artifact["status"]
    assert_equal 1, edited_artifact.dig("diagnostics", "manual_edit_count")
    assert_not_nil edited_artifact.dig("diagnostics", "manually_edited_at")
    assert_match %r{/rails/active_storage/blobs/proxy/}, edited_artifact["file_url"]

    delete preview_ai_workflow_url(workflow_id), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "deleted", response_json["status"]
    deleted_artifact = response_json.fetch("stages").flat_map { |stage| stage.fetch("artifacts") }.first
    assert_equal "deleted", deleted_artifact["status"]
    assert_nil deleted_artifact["file_url"]
    assert_not AiArtifact.find(deleted_artifact.fetch("id")).file.attached?
  end

  test "queues and completes a modeled outfit workflow" do
    outfit = outfits(:one)
    outfit.clothing_items.each { |item| item.photo.attach(item_photo_upload) }
    attach_model_references(@user, count: 2)

    workflow_id = nil
    captured_request = {}
    with_modeled_cleaner_stub(capture: captured_request) do
      assert_enqueued_with(job: ModeledOutfitGenerationJob) do
        post generate_modeled_image_outfit_url(outfit), headers: auth_headers(@user), as: :json
      end

      assert_response :accepted
      workflow_id = response_json.fetch("id")
      assert_equal "modeled_outfit", response_json["kind"]
      assert_equal "bytedance-seed/seedream-4.5", response_json["model"]
      assert_equal "modeled-outfit-v5-flatlay-composition", response_json["prompt_version"]
      assert_equal %w[prepare modeled verify], response_json.fetch("stages").map { |stage| stage.fetch("key") }

      perform_enqueued_jobs only: ModeledOutfitGenerationJob

      get ai_workflow_url(workflow_id), headers: auth_headers(@user), as: :json
    end

    assert_response :success
    assert_equal "succeeded", response_json["status"]
    assert response_json.fetch("stages").all? { |stage| stage.fetch("status") == "approved" }
    assert response_json.fetch("stages").all? { |stage| stage["decision"].nil? }
    artifact = response_json.fetch("stages").flat_map { |stage| stage.fetch("artifacts") }.first
    assert_equal "modeled_outfit_image", artifact["kind"]
    assert_equal "approved", artifact["status"]
    assert_equal "automatic", artifact.dig("diagnostics", "publication")
    private_references = captured_request.fetch(:reference_photos).select do |entry|
      entry.is_a?(Hash) && entry[:label].to_s.start_with?("Private model reference photo")
    end
    assert_equal 2, private_references.length
    assert_match %r{/rails/active_storage/blobs/proxy/}, artifact["file_url"]

    get outfit_url(outfit), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal workflow_id, response_json.dig("modeled_workflow", "id")
    assert_equal "modeled_outfit", response_json.dig("modeled_workflow", "kind")
    outfit_artifact = response_json.dig("modeled_workflow", "stages").flat_map { |stage| stage.fetch("artifacts") }.first
    assert_match %r{/rails/active_storage/blobs/proxy/}, outfit_artifact["file_url"]

    delete preview_ai_workflow_url(workflow_id), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "deleted", response_json["status"]
    deleted_artifact = response_json.fetch("stages").flat_map { |stage| stage.fetch("artifacts") }.first
    assert_equal "deleted", deleted_artifact["status"]
  end

  test "models the current unsaved outfit draft instead of the saved outfit links" do
    outfit = outfits(:one)
    draft_item = @user.clothing_items.create!(
      name: "Draft-only trousers",
      category: "bottom",
      style_notes: "Wide-leg black trousers"
    )
    draft_item.photo.attach(item_photo_upload)
    attach_model_references(@user, count: 1)

    workflow_id = nil
    captured_request = {}
    with_modeled_cleaner_stub(capture: captured_request) do
      assert_enqueued_with(job: ModeledOutfitGenerationJob) do
        post generate_modeled_image_outfit_url(outfit), params: {
          modeled_outfit: {
            item_ids: [ draft_item.id ],
            name: "Unsaved gallery look",
            tags: [ "gallery", "evening" ],
            notes: "Use the current editor selection."
          },
          flatlay_snapshot: item_photo_upload
        }, headers: auth_headers(@user)
      end

      assert_response :accepted
      workflow_id = response_json.fetch("id")
      assert_equal [ draft_item.id ], response_json.dig("metadata", "item_ids")
      assert_equal "Unsaved gallery look", response_json.dig("metadata", "name")
      assert_equal "editor_draft", response_json.dig("metadata", "source_state")
      assert_equal true, response_json.dig("metadata", "flatlay_snapshot_attached")
      assert AiWorkflow.find(workflow_id).input_file.attached?

      perform_enqueued_jobs only: ModeledOutfitGenerationJob

      get ai_workflow_url(workflow_id), headers: auth_headers(@user), as: :json
    end

    assert_response :success
    assert_equal "succeeded", response_json["status"]
    assert_equal "Unsaved gallery look", captured_request.dig(:prompt_context, :name)
    assert_equal "Use the current editor selection.", captured_request.dig(:prompt_context, :notes)
    assert_equal [ "Draft-only trousers" ], captured_request.dig(:prompt_context, :items).map { |item| item.fetch(:name) }
    assert_equal [ "gallery", "evening" ], captured_request.dig(:metadata_context, :tags)
    flatlay_references = captured_request.fetch(:reference_photos).select do |entry|
      entry.is_a?(Hash) && entry[:label].to_s.start_with?("Styled flat-lay composition reference")
    end
    assert_equal 1, flatlay_references.length
    artifact = response_json.fetch("stages").flat_map { |stage| stage.fetch("artifacts") }.first
    assert_equal [ draft_item.id ], artifact.dig("diagnostics", "item_ids")
    assert_equal "editor_draft", artifact.dig("diagnostics", "source_state")
    assert_equal true, artifact.dig("diagnostics", "flatlay_composition_reference")
    assert_not AiWorkflow.find(workflow_id).input_file.attached?
  end

  test "rejects a non-image flatlay composition snapshot" do
    outfit = outfits(:one)
    outfit.clothing_items.each { |item| item.photo.attach(item_photo_upload) }
    attach_model_references(@user, count: 1)
    invalid_snapshot = Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "text/plain")

    assert_no_enqueued_jobs do
      post generate_modeled_image_outfit_url(outfit), params: {
        modeled_outfit: {
          item_ids: outfit.clothing_item_ids,
          name: outfit.name,
          tags: outfit.tags,
          notes: outfit.notes
        },
        flatlay_snapshot: invalid_snapshot
      }, headers: auth_headers(@user)
    end

    assert_response :unprocessable_content
    assert_equal "The flat-lay snapshot must be an image.", response_json["error"]
  end

  test "does not model another user's item through an outfit draft" do
    attach_model_references(@user, count: 1)

    assert_no_enqueued_jobs do
      post generate_modeled_image_outfit_url(outfits(:one)), params: {
        modeled_outfit: {
          item_ids: [ clothing_items(:two).id ],
          name: "Invalid draft",
          tags: [],
          notes: ""
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :unprocessable_content
    assert_equal "Modeled outfits can only use items from your closet.", response_json["error"]
  end

  test "does not allow a user to edit another user's modeled preview" do
    workflow = @other_user.ai_workflows.create!(kind: "modeled_item", status: "succeeded")
    workflow.initialize_stages!
    artifact = workflow.stage("modeled").artifacts.create!(kind: "modeled_image", status: "approved")
    artifact.file.attach(item_photo_upload)

    patch preview_ai_workflow_url(workflow), params: {
      modeled_preview: { photo: item_photo_upload }
    }, headers: auth_headers(@user)

    assert_response :not_found
    assert_equal 0, artifact.reload.diagnostics.fetch("manual_edit_count", 0)
  end

  test "deletes a legacy modeled preview that is still in review" do
    item = clothing_items(:one)
    workflow = @user.ai_workflows.create!(kind: "modeled_item", subject: item, status: "review")
    workflow.initialize_stages!
    workflow.stage("prepare").approve!
    workflow.stage("modeled").review!
    workflow.stage("verify").review!
    artifact = workflow.stage("modeled").artifacts.create!(
      subject: item,
      kind: "modeled_image",
      status: "review"
    )
    artifact.file.attach(item_photo_upload)

    delete preview_ai_workflow_url(workflow), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "deleted", response_json["status"]
    assert_equal "deleted", response_json.fetch("stages").flat_map { |stage| stage.fetch("artifacts") }.first["status"]
    assert_not artifact.reload.file.attached?
  end

  private

  def item_photo_upload
    Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
  end

  def attach_model_references(user, count:)
    count.times do |position|
      reference = user.model_reference_images.build(position: position)
      reference.photo.attach(item_photo_upload)
      reference.save!
    end
    user.update!(model_reference_consent_at: Time.current)
  end

  def with_modeled_cleaner_stub(capture: nil, on_generate: nil)
    original = OpenrouterImageCleaner.method(:call)
    OpenrouterImageCleaner.singleton_class.send(:define_method, :call) do |_source_photo, mode: :catalog, **options|
      raise "expected modeled generation" unless %i[modeled modeled_outfit].include?(mode)
      capture&.replace(options.merge(mode: mode))
      on_generate&.call

      tempfile = Tempfile.new([ "modeled-preview", ".png" ])
      tempfile.binmode
      tempfile.write(File.binread(Rails.root.join("test/fixtures/files/item-photo.png")))
      tempfile.rewind
      {
        tempfile: tempfile,
        filename: "ivory-blouse-clean.png",
        content_type: "image/png",
        provider: "openrouter",
        model: "test/modeled",
        provider_api: "images",
        aspect_ratio: "4:5",
        resolution: "2K",
        usage: { "cost" => 0.04 }
      }
    end
    yield
  ensure
    OpenrouterImageCleaner.singleton_class.send(:define_method, :call, original)
  end
end
