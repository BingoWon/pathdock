import os
from PIL import Image


def resize_image(input_path, output_path, size):
    """Resize an image to the given size and save it."""
    image = Image.open(input_path)
    # Use Image.Resampling.LANCZOS for high-quality downsampling
    resized_image = image.resize((size, size), Image.Resampling.LANCZOS)
    resized_image.save(output_path)


def main(image_path):
    sizes = [16, 19, 32, 38, 48, 128]
    if not os.path.isfile(image_path):
        print(f"The file {image_path} does not exist.")
        return

    # Extract the file name and directory to save the resized images next to the script
    directory = os.path.dirname(os.path.abspath(__file__))
    base_name = os.path.basename(image_path)
    file_name, file_ext = os.path.splitext(base_name)

    for size in sizes:
        output_file_name = f"{file_name}-{size}.png"
        output_path = os.path.join(directory, output_file_name)
        resize_image(image_path, output_path, size)
        print(f"Saved {output_path}")


if __name__ == "__main__":
    original_image_path = r"browser\edge_extension\images\icon.png"
    main(original_image_path)
