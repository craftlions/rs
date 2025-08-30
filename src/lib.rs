use napi::bindgen_prelude::*;
use napi_derive::napi;
use pdfium_render::prelude::*;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use url::Url;

fn module_path_as_fs_path(env: &Env) -> Result<PathBuf> {
    let s = env.get_module_file_name()?;
    if s.starts_with("file://") {
        let url = Url::parse(&s).map_err(|e| Error::from_reason(format!("bad file URL: {e}")))?;
        url.to_file_path()
            .map_err(|_| Error::from_reason("cannot convert file URL to path"))
    } else {
        Ok(PathBuf::from(s))
    }
}

#[napi]
pub fn pdf_to_png(env: Env, bytes: Buffer) -> Result<Buffer> {
    let module_path = module_path_as_fs_path(&env)?;

    let dir = Path::new(&module_path)
        .parent()
        .ok_or_else(|| Error::from_reason("Addon path has no parent"))?
        .to_path_buf();

    let path = Pdfium::pdfium_platform_library_name_at_path(&dir);

    let pdfium = Pdfium::new(
        Pdfium::bind_to_library(&path)
            .map_err(|e| Error::from_reason(format!("Could not load PDFium: {e}")))?,
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
