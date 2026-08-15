from io import BytesIO

from PIL import Image, ImageOps


def compress_full(data: bytes, max_side: int = 1600, quality: int = 82) -> tuple[bytes, str]:
    image = Image.open(BytesIO(data))
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")
    image.thumbnail((max_side, max_side))
    out = BytesIO()
    image.save(out, format="JPEG", quality=quality, optimize=True)
    return out.getvalue(), "image/jpeg"


def make_thumb(data: bytes, max_side: int = 480, quality: int = 70) -> tuple[bytes, str]:
    image = Image.open(BytesIO(data))
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")
    image.thumbnail((max_side, max_side))
    out = BytesIO()
    image.save(out, format="JPEG", quality=quality, optimize=True)
    return out.getvalue(), "image/jpeg"
