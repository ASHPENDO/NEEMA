from PIL import Image, ImageOps
import os
import uuid


OUTPUT_SIZE = 1080
MARGIN_RATIO = 0.9  # ensures visible padding


def _get_average_brightness(image: Image.Image) -> float:
    """
    Compute average brightness of an image.
    """
    grayscale = image.convert("L")
    histogram = grayscale.histogram()

    pixels = sum(histogram)
    brightness = sum(i * histogram[i] for i in range(256)) / pixels

    return brightness


def process_image(input_path: str) -> str:
    """
    Process product image into 1080x1080 square with background.

    Steps:
    - Fix EXIF orientation
    - Resize (maintain aspect ratio with margin)
    - Detect brightness
    - Create square canvas
    - Center image
    - Save optimized image

    Returns:
        output_path (str)
    """
    try:
        # ✅ Fix EXIF orientation
        img = Image.open(input_path)
        img = ImageOps.exif_transpose(img).convert("RGB")

        # ✅ Resize with margin (important improvement)
        max_size = int(OUTPUT_SIZE * MARGIN_RATIO)
        img.thumbnail((max_size, max_size))

        # Determine background color
        brightness = _get_average_brightness(img)

        if brightness > 200:
            background_color = (30, 30, 30)  # dark
        else:
            background_color = (255, 255, 255)  # white

        # Create square canvas
        canvas = Image.new("RGB", (OUTPUT_SIZE, OUTPUT_SIZE), background_color)

        # Center image
        x_offset = (OUTPUT_SIZE - img.width) // 2
        y_offset = (OUTPUT_SIZE - img.height) // 2

        canvas.paste(img, (x_offset, y_offset))

        # Output path
        output_dir = os.path.dirname(input_path)
        filename = f"processed_{uuid.uuid4().hex}.jpg"
        output_path = os.path.join(output_dir, filename)

        # Save optimized image
        canvas.save(output_path, format="JPEG", quality=85, optimize=True)

        return output_path

    except Exception as e:
        print(f"[MediaProcessor] Failed: {e}")
        return input_path