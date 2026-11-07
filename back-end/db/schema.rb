# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_09_12_000000) do
  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "ai_artifacts", force: :cascade do |t|
    t.integer "ai_workflow_stage_id", null: false
    t.datetime "approved_at"
    t.datetime "created_at", null: false
    t.json "diagnostics", default: {}, null: false
    t.text "error_message"
    t.string "kind", null: false
    t.json "metadata", default: {}, null: false
    t.string "model"
    t.string "prompt_version"
    t.string "provider"
    t.datetime "rejected_at"
    t.string "source_fingerprint"
    t.string "status", default: "pending", null: false
    t.integer "subject_id"
    t.string "subject_type"
    t.datetime "updated_at", null: false
    t.index ["ai_workflow_stage_id"], name: "index_ai_artifacts_on_ai_workflow_stage_id"
    t.index ["subject_type", "subject_id", "kind"], name: "index_ai_artifacts_on_subject_type_and_subject_id_and_kind"
    t.index ["subject_type", "subject_id"], name: "index_ai_artifacts_on_subject"
  end

  create_table "ai_workflow_stages", force: :cascade do |t|
    t.integer "ai_workflow_id", null: false
    t.integer "attempts", default: 0, null: false
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.string "decision"
    t.json "diagnostics", default: {}, null: false
    t.text "error_message"
    t.string "key", null: false
    t.text "prompt"
    t.datetime "started_at"
    t.string "status", default: "pending", null: false
    t.datetime "updated_at", null: false
    t.index ["ai_workflow_id", "key"], name: "index_ai_workflow_stages_on_ai_workflow_id_and_key", unique: true
    t.index ["ai_workflow_id"], name: "index_ai_workflow_stages_on_ai_workflow_id"
  end

  create_table "ai_workflows", force: :cascade do |t|
    t.datetime "completed_at"
    t.integer "completed_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.text "error_message"
    t.integer "failed_count", default: 0, null: false
    t.string "kind", null: false
    t.json "metadata", default: {}, null: false
    t.string "model"
    t.string "prompt_version"
    t.string "provider"
    t.integer "requested_count"
    t.datetime "started_at"
    t.string "status", default: "pending", null: false
    t.integer "subject_id"
    t.string "subject_type"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["subject_type", "subject_id"], name: "index_ai_workflows_on_subject"
    t.index ["user_id", "status"], name: "index_ai_workflows_on_user_id_and_status"
    t.index ["user_id"], name: "index_ai_workflows_on_user_id"
  end

  create_table "clothing_items", force: :cascade do |t|
    t.string "brand", limit: 80
    t.string "category", limit: 60
    t.boolean "clean_image_cutout_fallback", default: false
    t.text "clean_image_error_message"
    t.datetime "clean_image_generated_at"
    t.string "clean_image_model"
    t.string "clean_image_provider"
    t.integer "clean_image_status", default: 0, null: false
    t.string "clean_image_variant"
    t.datetime "created_at", null: false
    t.datetime "date"
    t.string "name", limit: 120, null: false
    t.integer "size"
    t.integer "source_outfit_detection_id"
    t.integer "source_outfit_upload_id"
    t.text "style_notes"
    t.json "tags"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["source_outfit_detection_id"], name: "index_clothing_items_on_source_outfit_detection_id"
    t.index ["source_outfit_upload_id"], name: "index_clothing_items_on_source_outfit_upload_id"
    t.index ["user_id"], name: "index_clothing_items_on_user_id"
  end

  create_table "decorations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_decorations_on_user_id"
  end

  create_table "model_reference_images", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "position", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id", "position"], name: "index_model_reference_images_on_user_id_and_position", unique: true
    t.index ["user_id"], name: "index_model_reference_images_on_user_id"
  end

  create_table "outfit_decorations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "decoration_id", null: false
    t.integer "layer_order", default: 0, null: false
    t.integer "outfit_id", null: false
    t.decimal "rotation", precision: 6, scale: 2, default: "0.0", null: false
    t.datetime "updated_at", null: false
    t.decimal "width", precision: 6, scale: 2, default: "20.0", null: false
    t.decimal "x", precision: 6, scale: 2, default: "35.0", null: false
    t.decimal "y", precision: 6, scale: 2, default: "35.0", null: false
    t.index ["decoration_id"], name: "index_outfit_decorations_on_decoration_id"
    t.index ["outfit_id"], name: "index_outfit_decorations_on_outfit_id"
  end

  create_table "outfit_detections", force: :cascade do |t|
    t.float "bbox_height"
    t.float "bbox_width"
    t.float "bbox_x"
    t.float "bbox_y"
    t.string "category", null: false
    t.boolean "clean_image_cutout_fallback", default: false
    t.text "clean_image_error_message"
    t.datetime "clean_image_generated_at"
    t.string "clean_image_model"
    t.string "clean_image_provider"
    t.integer "clean_image_status", default: 0, null: false
    t.string "clean_image_variant"
    t.float "coarse_bbox_height"
    t.float "coarse_bbox_width"
    t.float "coarse_bbox_x"
    t.float "coarse_bbox_y"
    t.float "confidence"
    t.datetime "created_at", null: false
    t.integer "crop_attempts", default: 0, null: false
    t.float "crop_confidence"
    t.text "crop_notes"
    t.float "crop_quality_score"
    t.integer "crop_status", default: 0, null: false
    t.json "details"
    t.float "final_bbox_height"
    t.float "final_bbox_width"
    t.float "final_bbox_x"
    t.float "final_bbox_y"
    t.integer "outfit_upload_id", null: false
    t.integer "position", default: 0, null: false
    t.float "refined_bbox_height"
    t.float "refined_bbox_width"
    t.float "refined_bbox_x"
    t.float "refined_bbox_y"
    t.string "suggested_name"
    t.datetime "updated_at", null: false
    t.index ["outfit_upload_id"], name: "index_outfit_detections_on_outfit_upload_id"
  end

  create_table "outfit_example_descriptions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.json "description", default: {}, null: false
    t.string "fingerprint", null: false
    t.integer "outfit_id", null: false
    t.datetime "updated_at", null: false
    t.index ["outfit_id"], name: "index_outfit_example_descriptions_on_outfit_id", unique: true
  end

  create_table "outfit_experiments", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.json "manifest", default: {}, null: false
    t.string "name", null: false
    t.decimal "reserved_usd", precision: 12, scale: 8, default: "0.0", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id", "name"], name: "index_outfit_experiments_on_user_id_and_name", unique: true
    t.index ["user_id"], name: "index_outfit_experiments_on_user_id"
  end

  create_table "outfit_folder_decorations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "decoration_id"
    t.integer "layer_order", default: 0, null: false
    t.integer "outfit_folder_id", null: false
    t.string "page_key", limit: 80, null: false
    t.decimal "rotation", precision: 7, scale: 3, default: "0.0", null: false
    t.datetime "updated_at", null: false
    t.decimal "width", precision: 7, scale: 3, default: "20.0", null: false
    t.decimal "x", precision: 7, scale: 3, default: "8.0", null: false
    t.decimal "y", precision: 7, scale: 3, default: "8.0", null: false
    t.index ["decoration_id"], name: "index_outfit_folder_decorations_on_decoration_id"
    t.index ["outfit_folder_id", "page_key", "layer_order"], name: "index_outfit_folder_decorations_on_page_order"
    t.index ["outfit_folder_id"], name: "index_outfit_folder_decorations_on_outfit_folder_id"
  end

  create_table "outfit_folder_memberships", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "outfit_folder_id", null: false
    t.integer "outfit_id", null: false
    t.integer "position", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["outfit_folder_id", "outfit_id"], name: "index_outfit_folder_memberships_on_folder_and_outfit", unique: true
    t.index ["outfit_folder_id"], name: "index_outfit_folder_memberships_on_outfit_folder_id"
    t.index ["outfit_id"], name: "index_outfit_folder_memberships_on_outfit_id"
  end

  create_table "outfit_folders", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", limit: 120, null: false
    t.text "notes"
    t.string "occasion", limit: 120
    t.json "page_layouts", default: {}, null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_outfit_folders_on_user_id"
  end

  create_table "outfit_items", force: :cascade do |t|
    t.integer "clothing_item_id", null: false
    t.float "collage_height"
    t.float "collage_rotation", default: 0.0, null: false
    t.float "collage_width"
    t.float "collage_x"
    t.float "collage_y"
    t.datetime "created_at", null: false
    t.integer "layer_order", default: 0, null: false
    t.integer "outfit_id", null: false
    t.datetime "updated_at", null: false
    t.index ["clothing_item_id"], name: "index_outfit_items_on_clothing_item_id"
    t.index ["outfit_id", "clothing_item_id"], name: "index_outfit_items_on_outfit_id_and_clothing_item_id", unique: true
    t.index ["outfit_id"], name: "index_outfit_items_on_outfit_id"
  end

  create_table "outfit_preference_profiles", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.json "profile_data", default: {}, null: false
    t.datetime "rebuilt_at"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.string "version", null: false
    t.index ["user_id"], name: "index_outfit_preference_profiles_on_user_id", unique: true
  end

  create_table "outfit_provider_attempts", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "endpoint", null: false
    t.text "error_message"
    t.integer "latency_ms"
    t.string "model", null: false
    t.integer "outfit_experiment_id"
    t.integer "outfit_recommendation_run_id"
    t.decimal "reserved_usd", precision: 12, scale: 8, null: false
    t.string "status", default: "reserved", null: false
    t.datetime "updated_at", null: false
    t.json "usage", default: {}, null: false
    t.index ["outfit_experiment_id"], name: "index_outfit_provider_attempts_on_outfit_experiment_id"
    t.index ["outfit_recommendation_run_id"], name: "index_outfit_provider_attempts_on_outfit_recommendation_run_id"
  end

  create_table "outfit_recommendation_feedback_events", force: :cascade do |t|
    t.integer "clothing_item_id"
    t.datetime "created_at", null: false
    t.string "event_type", null: false
    t.json "metadata", default: {}, null: false
    t.integer "outfit_recommendation_option_id"
    t.integer "outfit_recommendation_run_id", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["clothing_item_id"], name: "idx_on_clothing_item_id_16e446dd30"
    t.index ["event_type"], name: "index_outfit_recommendation_feedback_events_on_event_type"
    t.index ["outfit_recommendation_option_id"], name: "idx_recommendation_feedback_on_option"
    t.index ["outfit_recommendation_run_id"], name: "idx_recommendation_feedback_on_run"
    t.index ["user_id"], name: "index_outfit_recommendation_feedback_events_on_user_id"
  end

  create_table "outfit_recommendation_options", force: :cascade do |t|
    t.json "clothing_item_ids", default: [], null: false
    t.datetime "created_at", null: false
    t.json "hard_violations", default: [], null: false
    t.decimal "judge_score", precision: 7, scale: 3
    t.json "judge_scores", default: {}, null: false
    t.decimal "local_score", precision: 7, scale: 3
    t.integer "outfit_id"
    t.integer "outfit_recommendation_run_id", null: false
    t.integer "rank"
    t.json "reasons", default: [], null: false
    t.string "status", default: "candidate", null: false
    t.text "summary"
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["outfit_id"], name: "index_outfit_recommendation_options_on_outfit_id"
    t.index ["outfit_recommendation_run_id", "rank"], name: "idx_recommendation_options_run_rank", unique: true
    t.index ["outfit_recommendation_run_id"], name: "idx_recommendation_options_on_run"
  end

  create_table "outfit_recommendation_runs", force: :cascade do |t|
    t.json "candidate_item_sets", default: [], null: false
    t.datetime "completed_at"
    t.json "constraints", default: {}, null: false
    t.datetime "created_at", null: false
    t.text "error_message"
    t.json "judge_rubric", default: {}, null: false
    t.json "models", default: {}, null: false
    t.integer "parent_run_id"
    t.text "prompt", null: false
    t.text "result_message"
    t.string "status", default: "pending", null: false
    t.json "structured_brief", default: {}, null: false
    t.datetime "updated_at", null: false
    t.json "usage", default: {}, null: false
    t.integer "user_id", null: false
    t.index ["parent_run_id"], name: "index_outfit_recommendation_runs_on_parent_run_id"
    t.index ["status"], name: "index_outfit_recommendation_runs_on_status"
    t.index ["user_id"], name: "index_outfit_recommendation_runs_on_user_id"
  end

  create_table "outfit_uploads", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "detected_at"
    t.text "error_message"
    t.string "provider"
    t.json "raw_response"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.string "vision_model"
    t.index ["user_id"], name: "index_outfit_uploads_on_user_id"
  end

  create_table "outfits", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", limit: 120, null: false
    t.text "notes"
    t.json "tags"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_outfits_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.boolean "admin", default: false, null: false
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.string "email", limit: 254
    t.datetime "model_reference_consent_at"
    t.string "password_digest"
    t.string "preferred_style", limit: 40
    t.string "provider", limit: 60, null: false
    t.string "uid", limit: 255, null: false
    t.datetime "updated_at", null: false
    t.string "username", limit: 60, null: false
    t.index ["email"], name: "index_users_on_email"
    t.index ["provider", "uid"], name: "index_users_on_provider_and_uid", unique: true
  end

  create_table "wardrobe_image_versions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "imageable_id", null: false
    t.string "imageable_type", null: false
    t.json "metadata", default: {}, null: false
    t.string "model"
    t.integer "parent_id"
    t.string "provider"
    t.boolean "selected", default: false, null: false
    t.datetime "updated_at", null: false
    t.string "variant_kind", null: false
    t.index ["imageable_type", "imageable_id", "selected"], name: "index_wardrobe_image_versions_on_owner_and_selected"
    t.index ["imageable_type", "imageable_id", "variant_kind"], name: "index_wardrobe_image_versions_on_owner_and_kind", unique: true
    t.index ["imageable_type", "imageable_id"], name: "index_wardrobe_image_versions_on_imageable"
    t.index ["parent_id"], name: "index_wardrobe_image_versions_on_parent_id"
  end

  create_table "wardrobe_item_analyses", force: :cascade do |t|
    t.string "analysis_version"
    t.datetime "analyzed_at"
    t.integer "clothing_item_id", null: false
    t.datetime "created_at", null: false
    t.json "dominant_colors", default: [], null: false
    t.json "embedding", default: [], null: false
    t.datetime "enriched_at"
    t.text "enrichment_error_message"
    t.string "enrichment_fingerprint"
    t.string "enrichment_model"
    t.string "enrichment_status", default: "pending", null: false
    t.string "enrichment_version"
    t.text "error_message"
    t.json "extracted_attributes", default: {}, null: false
    t.string "metadata_fingerprint"
    t.string "model"
    t.string "provider"
    t.string "source_fingerprint"
    t.string "status", default: "pending", null: false
    t.datetime "updated_at", null: false
    t.index ["clothing_item_id"], name: "index_wardrobe_item_analyses_on_clothing_item_id", unique: true
    t.index ["enrichment_status"], name: "index_wardrobe_item_analyses_on_enrichment_status"
    t.index ["status"], name: "index_wardrobe_item_analyses_on_status"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "ai_artifacts", "ai_workflow_stages"
  add_foreign_key "ai_workflow_stages", "ai_workflows"
  add_foreign_key "ai_workflows", "users"
  add_foreign_key "clothing_items", "users"
  add_foreign_key "decorations", "users"
  add_foreign_key "model_reference_images", "users"
  add_foreign_key "outfit_decorations", "decorations"
  add_foreign_key "outfit_decorations", "outfits"
  add_foreign_key "outfit_detections", "outfit_uploads"
  add_foreign_key "outfit_example_descriptions", "outfits", on_delete: :cascade
  add_foreign_key "outfit_experiments", "users"
  add_foreign_key "outfit_folder_decorations", "decorations"
  add_foreign_key "outfit_folder_decorations", "outfit_folders"
  add_foreign_key "outfit_folder_memberships", "outfit_folders"
  add_foreign_key "outfit_folder_memberships", "outfits"
  add_foreign_key "outfit_folders", "users"
  add_foreign_key "outfit_items", "clothing_items"
  add_foreign_key "outfit_items", "outfits"
  add_foreign_key "outfit_preference_profiles", "users"
  add_foreign_key "outfit_provider_attempts", "outfit_experiments"
  add_foreign_key "outfit_provider_attempts", "outfit_recommendation_runs"
  add_foreign_key "outfit_recommendation_feedback_events", "clothing_items"
  add_foreign_key "outfit_recommendation_feedback_events", "outfit_recommendation_options"
  add_foreign_key "outfit_recommendation_feedback_events", "outfit_recommendation_runs"
  add_foreign_key "outfit_recommendation_feedback_events", "users"
  add_foreign_key "outfit_recommendation_options", "outfit_recommendation_runs"
  add_foreign_key "outfit_recommendation_options", "outfits"
  add_foreign_key "outfit_recommendation_runs", "outfit_recommendation_runs", column: "parent_run_id"
  add_foreign_key "outfit_recommendation_runs", "users"
  add_foreign_key "outfit_uploads", "users"
  add_foreign_key "outfits", "users"
  add_foreign_key "wardrobe_image_versions", "wardrobe_image_versions", column: "parent_id"
  add_foreign_key "wardrobe_item_analyses", "clothing_items"
end
