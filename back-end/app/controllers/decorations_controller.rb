class DecorationsController < ApplicationController
  before_action :require_login
  before_action :set_decoration, only: %i[update destroy]

  def index
    decorations = current_user.decorations.with_attached_image.order(created_at: :desc)
    render json: decorations.map { |decoration| payloads.decoration(decoration) }
  end

  def create
    decoration = current_user.decorations.new(decoration_params.except(:image))
    decoration.image.attach(decoration_params[:image]) if decoration_params[:image].present?

    if decoration.save
      render json: payloads.decoration(decoration), status: :created
    else
      render_validation_errors(decoration)
    end
  end

  def update
    @decoration.assign_attributes(decoration_params.except(:image))
    @decoration.image.attach(decoration_params[:image]) if decoration_params[:image].present?

    if @decoration.save
      render json: payloads.decoration(@decoration)
    else
      render_validation_errors(@decoration)
    end
  end

  def destroy
    @decoration.destroy!
    head :no_content
  end

  private

  def set_decoration
    @decoration = current_user.decorations.find(params[:id])
  end

  def decoration_params
    params.require(:decoration).permit(:name, :image)
  end
end
