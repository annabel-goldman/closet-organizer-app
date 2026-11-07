class OutfitUploadAnalyzer
  def self.call(outfit_upload)
    new(outfit_upload).call
  end

  def initialize(outfit_upload)
    @outfit_upload = outfit_upload
  end

  def call
    outfit_upload.update!(status: :processing, error_message: nil)

    result = OutfitPhotoDetector.call(outfit_upload)
    replace_detections!(result.fetch(:items, []))

    outfit_upload.update!(
      status: :succeeded,
      provider: result[:provider],
      vision_model: result[:vision_model],
      raw_response: result[:raw_response],
      detected_at: Time.current
    )
  rescue StandardError => error
    mark_upload_failed(error)
    raise
  end

  private

  attr_reader :outfit_upload

  def replace_detections!(items)
    outfit_upload.transaction do
      outfit_upload.outfit_detections.delete_all
      items.each_with_index.map do |item, index|
        outfit_upload.outfit_detections.create!(detection_attributes(item, index))
      end
    end
  end

  def detection_attributes(item, index)
    {
      category: item.fetch(:category),
      confidence: item[:confidence],
      suggested_name: item[:suggested_name],
      details: item[:details] || {},
      coarse_bbox_x: item.dig(:coarse_box, :x),
      coarse_bbox_y: item.dig(:coarse_box, :y),
      coarse_bbox_width: item.dig(:coarse_box, :width),
      coarse_bbox_height: item.dig(:coarse_box, :height),
      bbox_x: item.dig(:bounding_box, :x),
      bbox_y: item.dig(:bounding_box, :y),
      bbox_width: item.dig(:bounding_box, :width),
      bbox_height: item.dig(:bounding_box, :height),
      position: index
    }
  end

  def mark_upload_failed(error)
    outfit_upload.update!(status: :failed, error_message: error.message)
  rescue StandardError => status_error
    Rails.logger.error(
      "Could not persist failed state for outfit upload #{outfit_upload.id}: " \
      "#{status_error.class}: #{status_error.message}"
    )
  end
end
