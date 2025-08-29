use napi::bindgen_prelude::*;
use napi_derive::napi;
use pdfium_render::prelude::*;
use std::io::Cursor;

#[napi]
pub fn pdf_to_png(bytes: Buffer) -> Result<Buffer> {
    let pdfium = Pdfium::new(
        Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./"))
            .expect("Could not load PDFium"),
    );

    let document = pdfium
        .load_pdf_from_byte_vec(bytes.to_vec(), None)
        .map_err(|e| Error::from_reason(format!("Failed to load PDF: {:?}", e)))?;

    let page = document
        .pages()
        .get(0)
        .map_err(|e| Error::from_reason(format!("Failed to get first page: {:?}", e)))?;

    let page_size = page.page_size();
    let width_pts = page_size.width().value;
    let height_pts = page_size.height().value;

    let dpi_value = 144.0;
    let width_px: i32 = ((width_pts / 72.0) * dpi_value).round() as i32;
    let height_px: i32 = ((height_pts / 72.0) * dpi_value).round() as i32;

    let render_config = PdfRenderConfig::new()
        .set_target_width(width_px)
        .set_maximum_height(height_px)
        .rotate_if_landscape(PdfPageRenderRotation::Degrees90, true);

    let dyn_img = page
        .render_with_config(&render_config)
        .map_err(|e| Error::from_reason(format!("Render error: {:?}", e)))?
        .as_image();

    let mut buf = Vec::new();
    dyn_img
        .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| Error::from_reason(format!("Image encode error: {:?}", e)))?;

    Ok(Buffer::from(buf))
}
