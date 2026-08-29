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

ActiveRecord::Schema[8.1].define(version: 2026_08_28_014000) do
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

  create_table "model_reference_images", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "position", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id", "position"], name: "index_model_reference_images_on_user_id_and_position", unique: true
    t.index ["user_id"], name: "index_model_reference_images_on_user_id"
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

  create_table "outfit_folder_decorations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "layer_order", default: 0, null: false
    t.integer "outfit_folder_id", null: false
    t.string "page_key", limit: 80, null: false
    t.decimal "rotation", precision: 7, scale: 3, default: "0.0", null: false
    t.datetime "updated_at", null: false
    t.decimal "width", precision: 7, scale: 3, default: "20.0", null: false
    t.decimal "x", precision: 7, scale: 3, default: "8.0", null: false
    t.decimal "y", precision: 7, scale: 3, default: "8.0", null: false
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
    t.string "theme", limit: 40, default: "editorial", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_outfit_folders_on_user_id"
  end

  create_table "outfit_generation_events", force: :cascade do |t|
    t.json "added_item_ids", default: [], null: false
    t.datetime "created_at", null: false
    t.string "event_type", null: false
    t.json "final_item_ids", default: [], null: false
    t.json "kept_item_ids", default: [], null: false
    t.integer "outfit_generation_run_id", null: false
    t.json "removed_item_ids", default: [], null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_outfit_generation_events_on_created_at"
    t.index ["event_type"], name: "index_outfit_generation_events_on_event_type"
    t.index ["outfit_generation_run_id"], name: "index_outfit_generation_events_on_run_id"
  end

  create_table "outfit_generation_runs", force: :cascade do |t|
    t.json "candidate_item_ids", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "generated_at", null: false
    t.json "generated_item_ids", default: [], null: false
    t.string "generator_version", null: false
    t.string "occasion"
    t.integer "outfit_id"
    t.json "reference_profile"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["generated_at"], name: "index_outfit_generation_runs_on_generated_at"
    t.index ["outfit_id"], name: "index_outfit_generation_runs_on_outfit_id"
    t.index ["user_id"], name: "index_outfit_generation_runs_on_user_id"
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

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "ai_artifacts", "ai_workflow_stages"
  add_foreign_key "ai_workflow_stages", "ai_workflows"
  add_foreign_key "ai_workflows", "users"
  add_foreign_key "clothing_items", "users"
  add_foreign_key "model_reference_images", "users"
  add_foreign_key "outfit_detections", "outfit_uploads"
  add_foreign_key "outfit_folder_decorations", "outfit_folders"
  add_foreign_key "outfit_folder_memberships", "outfit_folders"
  add_foreign_key "outfit_folder_memberships", "outfits"
  add_foreign_key "outfit_folders", "users"
  add_foreign_key "outfit_generation_events", "outfit_generation_runs"
  add_foreign_key "outfit_generation_runs", "outfits", on_delete: :nullify
  add_foreign_key "outfit_generation_runs", "users"
  add_foreign_key "outfit_items", "clothing_items"
  add_foreign_key "outfit_items", "outfits"
  add_foreign_key "outfit_uploads", "users"
  add_foreign_key "outfits", "users"
end
