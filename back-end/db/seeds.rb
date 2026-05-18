require "date"

srand(20260517)

ActiveRecord::Base.transaction do
  OutfitItem.delete_all
  Outfit.delete_all
  ClothingItem.delete_all
  User.delete_all
end

WARDROBE_LIBRARY = {
  smart_casual: [
    [ "Oxford Shirt", [ "j.crew", "cotton", "blue", "office", "layering" ] ],
    [ "Merino Crewneck Sweater", [ "uniqlo", "merino wool", "charcoal", "cozy", "polished" ] ],
    [ "Straight-Leg Jeans", [ "madewell", "denim", "indigo", "everyday", "classic" ] ],
    [ "Tailored Chinos", [ "banana republic", "twill", "khaki", "workwear", "tailored" ] ],
    [ "Leather Loafers", [ "sam edelman", "leather", "black", "dressy", "classic" ] ],
    [ "Single-Breasted Blazer", [ "theory", "wool blend", "navy", "office", "sharp" ] ]
  ],
  athleisure: [
    [ "Training Joggers", [ "lululemon", "recycled polyester", "black", "active", "weekend" ] ],
    [ "Performance Tee", [ "nike", "moisture wicking", "heather gray", "gym", "breathable" ] ],
    [ "Running Hoodie", [ "under armour", "performance fleece", "gray", "cozy", "active" ] ],
    [ "Quarter-Zip Pullover", [ "vuori", "polyester", "navy", "layering", "commute" ] ],
    [ "Hybrid Shorts", [ "ten thousand", "nylon", "stone", "summer", "training" ] ],
    [ "Trail Shell Jacket", [ "patagonia", "ripstop", "olive", "outdoors", "weatherproof" ] ]
  ],
  minimal: [
    [ "Rib Tank", [ "uniqlo", "cotton", "black", "minimal", "basics" ] ],
    [ "Relaxed Trousers", [ "cos", "twill", "taupe", "workwear", "clean lines" ] ],
    [ "Linen Button-Down", [ "everlane", "linen", "white", "airy", "capsule" ] ],
    [ "Slip Skirt", [ "aritzia", "satin", "cream", "soft", "date night" ] ],
    [ "Wool Coat", [ "mango", "wool", "camel", "outerwear", "elevated" ] ],
    [ "Ankle Boots", [ "steve madden", "suede", "brown", "fall", "classic" ] ]
  ],
  vintage: [
    [ "Band Tee", [ "levis", "cotton", "washed black", "graphic", "casual" ] ],
    [ "High-Rise Mom Jeans", [ "levis", "denim", "light blue", "retro", "weekend" ] ],
    [ "Corduroy Jacket", [ "free people", "corduroy", "rust", "textured", "layering" ] ],
    [ "Pleated Midi Dress", [ "reformation", "viscose", "sage", "dressy", "romantic" ] ],
    [ "Western Boots", [ "frye", "leather", "cognac", "statement", "boots" ] ],
    [ "Wool Beret", [ "anthropologie", "wool", "burgundy", "accessory", "playful" ] ]
  ],
  polished: [
    [ "Silk Blouse", [ "sezane", "silk", "ivory", "polished", "workwear" ] ],
    [ "Pleated Trousers", [ "aritzia", "crepe", "black", "tailored", "office" ] ],
    [ "Cashmere Cardigan", [ "naadam", "cashmere", "oatmeal", "soft", "luxury" ] ],
    [ "Pencil Skirt", [ "theory", "wool blend", "charcoal", "office", "classic" ] ],
    [ "Block Heel Pumps", [ "cole haan", "leather", "black", "dressy", "heels" ] ],
    [ "Trench Coat", [ "everlane", "cotton blend", "sand", "outerwear", "timeless" ] ]
  ]
}.freeze

ADJECTIVES = %w[
  Classic Relaxed Textured Everyday Soft Structured Lightweight Refined Heritage
  Clean Tailored Cozy Cropped Oversized Slim Breathable Studio Weekend
].freeze

SIZE_PROFILES = {
  slim: %i[xs small medium medium medium],
  standard: %i[small medium medium large],
  relaxed: %i[medium large large xl]
}.freeze

OUTFIT_NAME_TEMPLATES = [
  "Monday Morning",
  "Coffee Run",
  "Office Day",
  "Date Night",
  "Weekend Brunch",
  "Studio Session",
  "Evening Out",
  "Travel Day",
  "Quiet Saturday",
  "Errand Loop",
  "Gallery Opening",
  "Cabin Weekend",
  "Sunday Reset",
  "Friday Drinks"
].freeze

FIRST_NAMES = %w[
  alex avery bailey blair cameron casey charlie dakota drew elliot emery finley
  hayden harper hunter jamie jordan kai kendall kennedy logan morgan parker
  payton peyton quinn reese riley rowan sage skyler sloan taylor teagan tristan
  remi ari ellis sutton ezra june theo aspen ridley remy linden
].freeze

LAST_NAMES = %w[
  abel albright bishop blakely carrington cole dove ellsworth fairbanks gallagher
  hartley ivory james kingsley lockhart monroe nash orchard pemberton quarry
  reyes sutherland tanaka underwood valencia winters xie yamamoto zane
  ashford brennan calder davenport everett fernsby greer huxley iverson kellerman
].freeze

PRESET_USERS = [
  {
    username: "annabel_goldman",
    email: "annabelgoldman2025@u.northwestern.edu",
    provider: "google_oauth2",
    uid: "seed-annabel-goldman",
    password: "password",
    admin: true,
    preferred_style: "polished",
    item_count: 20,
    outfit_count: 4,
    size_profile: :standard
  }
].freeze

STYLE_KEYS = WARDROBE_LIBRARY.keys.map(&:to_s).freeze
SIZE_KEYS = SIZE_PROFILES.keys.freeze

TARGET_TOTAL_USERS = 1_050
TARGET_TOTAL_ITEMS = 5_200
TARGET_TOTAL_OUTFITS = 2_100

def random_purchase_date
  Date.today - rand(20..540)
end

def build_item_name(base_name)
  "#{ADJECTIVES.sample} #{base_name}"
end

def build_clothing_item_attrs(user_id, style_key, size_pool)
  base_name, base_tags = WARDROBE_LIBRARY.fetch(style_key.to_sym).sample
  now = Time.current

  {
    name: build_item_name(base_name),
    size: ClothingItem.sizes.fetch(size_pool.sample.to_s),
    date: random_purchase_date,
    user_id: user_id,
    tags: base_tags + [ style_key.to_s.tr("_", " ") ],
    clean_image_status: 0,
    created_at: now,
    updated_at: now
  }
end

def unique_username(seen, base)
  candidate = base
  suffix = 2
  while seen.include?(candidate)
    candidate = "#{base}_#{suffix}"
    suffix += 1
  end
  seen << candidate
  candidate
end

def make_random_username(seen)
  base = "#{FIRST_NAMES.sample}_#{LAST_NAMES.sample}#{rand(10..9999)}"
  unique_username(seen, base)
end

puts "Creating preset users..."

seen_usernames = Set.new
preset_user_records = []

PRESET_USERS.each do |user_data|
  user = User.create!(
    username: user_data[:username],
    email: user_data[:email],
    provider: user_data[:provider],
    uid: user_data[:uid],
    password: user_data[:password],
    admin: user_data.fetch(:admin, false),
    preferred_style: user_data[:preferred_style]
  )
  seen_usernames << user.username
  preset_user_records << [ user, user_data ]
end

remaining_users = TARGET_TOTAL_USERS - preset_user_records.size
puts "Generating #{remaining_users} additional users (target: #{TARGET_TOTAL_USERS} total)..."

generated_user_rows = []
remaining_users.times do
  username = make_random_username(seen_usernames)
  preferred_style = STYLE_KEYS.sample
  now = Time.current
  generated_user_rows << {
    username: username,
    email: "#{username}@example.com",
    provider: "seed",
    uid: "seed-#{username}",
    password_digest: BCrypt::Password.create("password", cost: BCrypt::Engine::MIN_COST),
    admin: false,
    preferred_style: preferred_style,
    created_at: now,
    updated_at: now
  }
end

User.insert_all(generated_user_rows) if generated_user_rows.any?

all_users = User.order(:id).to_a
puts "User count: #{all_users.size}"

preset_user_ids = preset_user_records.map { |user, _| user.id }
generated_users = all_users.reject { |user| preset_user_ids.include?(user.id) }

puts "Building preset clothing items and outfits..."

preset_item_rows = []
preset_user_records.each do |user, user_data|
  size_pool = SIZE_PROFILES.fetch(user_data.fetch(:size_profile, :standard))
  user_data.fetch(:item_count, 0).times do
    preset_item_rows << build_clothing_item_attrs(user.id, user.preferred_style, size_pool)
  end
end

ClothingItem.insert_all(preset_item_rows) if preset_item_rows.any?

# Distribute generated items across non-preset users.
preset_item_total = preset_item_rows.size
remaining_items = [ TARGET_TOTAL_ITEMS - preset_item_total, 0 ].max

puts "Generating #{remaining_items} additional clothing items..."

# Use a weighted distribution so most users have a few items, some have many.
# Weights chosen to produce a realistic long-tail distribution.
def sample_item_count_for_user
  roll = rand
  case roll
  when 0.0...0.15 then 0                # ~15% have no items
  when 0.15...0.55 then rand(1..3)      # ~40% have 1-3
  when 0.55...0.85 then rand(4..8)      # ~30% have 4-8
  when 0.85...0.97 then rand(9..15)     # ~12% have 9-15
  else rand(16..40)                     # ~3% have 16-40
  end
end

generated_item_rows = []
generated_users.each do |user|
  count = sample_item_count_for_user
  size_pool = SIZE_PROFILES.fetch(SIZE_KEYS.sample)
  count.times do
    generated_item_rows << build_clothing_item_attrs(user.id, user.preferred_style, size_pool)
    break if generated_item_rows.size >= remaining_items
  end
  break if generated_item_rows.size >= remaining_items
end

# Top up if we still haven't reached the target.
while generated_item_rows.size < remaining_items
  user = generated_users.sample
  size_pool = SIZE_PROFILES.fetch(SIZE_KEYS.sample)
  generated_item_rows << build_clothing_item_attrs(user.id, user.preferred_style, size_pool)
end

# Insert in batches to keep memory bounded.
generated_item_rows.each_slice(1_000) { |batch| ClothingItem.insert_all(batch) }

items_by_user = ClothingItem.pluck(:user_id, :id).group_by(&:first).transform_values { |rows| rows.map(&:last) }

puts "Total clothing items: #{ClothingItem.count}"

puts "Building outfits..."

preset_outfit_rows = []
preset_outfit_user_records = []
preset_user_records.each do |user, user_data|
  user_data.fetch(:outfit_count, 0).times do |i|
    now = Time.current
    preset_outfit_rows << {
      user_id: user.id,
      name: "#{OUTFIT_NAME_TEMPLATES.sample} #{i + 1}",
      tags: [ user.preferred_style ],
      notes: nil,
      created_at: now,
      updated_at: now
    }
    preset_outfit_user_records << user
  end
end

remaining_outfits = [ TARGET_TOTAL_OUTFITS - preset_outfit_rows.size, 0 ].max
puts "Generating #{remaining_outfits} additional outfits..."

# Outfit attachments: skip users with no items.
candidate_users = generated_users.select { |user| items_by_user[user.id]&.any? }
generated_outfit_rows = []
generated_outfit_user_ids = []

remaining_outfits.times do
  user = candidate_users.sample
  next unless user

  now = Time.current
  generated_outfit_rows << {
    user_id: user.id,
    name: "#{OUTFIT_NAME_TEMPLATES.sample} #{rand(1..99)}",
    tags: [ user.preferred_style, OUTFIT_NAME_TEMPLATES.sample.downcase ].uniq,
    notes: nil,
    created_at: now,
    updated_at: now
  }
  generated_outfit_user_ids << user.id
end

all_outfit_rows = preset_outfit_rows + generated_outfit_rows
all_outfit_rows.each_slice(1_000) { |batch| Outfit.insert_all(batch) }

puts "Total outfits: #{Outfit.count}"

puts "Linking outfit items..."

outfit_id_iter = Outfit.order(:id).pluck(:id).each
outfit_user_ids = preset_outfit_user_records.map(&:id) + generated_outfit_user_ids

outfit_item_rows = []
outfit_user_ids.each do |user_id|
  outfit_id = outfit_id_iter.next
  item_ids = items_by_user[user_id] || []
  next if item_ids.empty?

  pick_count = [ rand(2..5), item_ids.size ].min
  chosen_ids = item_ids.sample(pick_count)
  now = Time.current
  chosen_ids.each do |item_id|
    outfit_item_rows << {
      outfit_id: outfit_id,
      clothing_item_id: item_id,
      created_at: now,
      updated_at: now
    }
  end
end

outfit_item_rows.each_slice(2_000) { |batch| OutfitItem.insert_all(batch) }

puts "Seed complete:"
puts "  Users: #{User.count}"
puts "  Clothing items: #{ClothingItem.count}"
puts "  Outfits: #{Outfit.count}"
puts "  Outfit-item links: #{OutfitItem.count}"
