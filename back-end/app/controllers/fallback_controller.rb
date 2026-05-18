class FallbackController < ActionController::Base
  def index
    render file: resolved_index_path, layout: false
  rescue ArgumentError
    render html: fallback_html, layout: false
  end

  private

  def resolved_index_path
    [
      Rails.root.join("public/index.html"),
      Rails.root.parent.join("front-end/dist/index.html")
    ].find { |path| path.exist? } || Rails.root.join("public/index.html")
  end

  def fallback_html
    <<~HTML.html_safe
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Curated Closet</title>
          <link rel="icon" href="/favicon.png" type="image/png">
          <link rel="apple-touch-icon" href="/brand-mark.png">
        </head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    HTML
  end
end
