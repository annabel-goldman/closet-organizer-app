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

ActiveRecord::Schema[8.1].define(version: 2026_05_17_220000) do
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

  create_table "clothing_items", force: :cascade do |t|
    t.string "brand", limit: 80
    t.string "category", limit: 60
    t.text "clean_image_error_message"
    t.datetime "clean_image_generated_at"
    t.string "clean_image_model"
    t.string "clean_image_provider"
    t.integer "clean_image_status", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "date"
    t.string "name", limit: 120, null: false
    t.integer "size"
    t.integer "source_outfit_detection_id"
    t.integer "source_outfit_upload_id"
    t.json "tags"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["source_outfit_detection_id"], name: "index_clothing_items_on_source_outfit_detection_id"
    t.index ["source_outfit_upload_id"], name: "index_clothing_items_on_source_outfit_upload_id"
    t.index ["user_id"], name: "index_clothing_items_on_user_id"
  end

  create_table "outfit_detections", force: :cascade do |t|
    t.float "bbox_height"
    t.float "bbox_width"
    t.float "bbox_x"
    t.float "bbox_y"
    t.string "category", null: false
    t.text "clean_image_error_message"
    t.datetime "clean_image_generated_at"
    t.string "clean_image_model"
    t.string "clean_image_provider"
    t.integer "clean_image_status", default: 0, null: false
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

  create_table "outfit_items", force: :cascade do |t|
    t.integer "clothing_item_id", null: false
    t.datetime "created_at", null: false
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
  add_foreign_key "clothing_items", "users"
  add_foreign_key "outfit_detections", "outfit_uploads"
  add_foreign_key "outfit_items", "clothing_items"
  add_foreign_key "outfit_items", "outfits"
  add_foreign_key "outfit_uploads", "users"
  add_foreign_key "outfits", "users"
end
