import os
import random

# Folder containing the images
folder_path = "assets/img/genai_pics"

# Base path for the HTML href and img src attributes
base_href = "/assets/img/genai_pics/"
base_src = "/assets/img/genai_pics/"

# File extensions to include
image_extensions = {".png", ".jpg", ".jpeg", ".webp"}

# Get a list of all valid image files in the folder
image_files = [
    filename
    for filename in os.listdir(folder_path)
    if os.path.splitext(filename)[1].lower() in image_extensions
]

# Randomize the order of the images
random.shuffle(image_files)

# Generate HTML for each image
html_output = []
for filename in image_files:
    # Generate href and img src paths
    href_path = base_href + filename
    img_src_path = base_src + filename.replace(
        ".png", "-480.webp"
    )  # Adjusted to use 480

    # Generate HTML for the image
    html_code = (
        f'<a class="spotlight" href="{href_path}"><img src="{img_src_path}"/></a>'
    )
    html_output.append(html_code)

# Print the HTML output
for html in html_output:
    print(html)
