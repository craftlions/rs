use napi::bindgen_prelude::*;
use napi_derive::napi;
use pdfium_render::prelude::*;
use std::io::Cursor;
use std::path::PathBuf;
use url::Url;

const RENDER_DPI: f32 = 144.0;
const POINTS_PER_INCH: f32 = 72.0;

fn module_path_as_fs_path(env: Env) -> Result<PathBuf> {
    let s = env.get_module_file_name()?;
    if s.starts_with("file://") {
        let url = Url::parse(&s).map_err(|e| Error::from_reason(format!("bad file URL: {e}")))?;
        url.to_file_path()
            .map_err(|()| Error::from_reason("cannot convert file URL to path"))
    } else {
        Ok(PathBuf::from(s))
    }
}

/// Renders the first page of a PDF to PNG at 144 DPI.
///
/// # Errors
///
/// Fails if PDFium cannot be loaded or the PDF cannot be rendered.
#[napi]
pub fn pdf_to_png(env: Env, bytes: Buffer) -> Result<Buffer> {
    let module_path = module_path_as_fs_path(env)?;

    let dir = module_path
        .parent()
        .ok_or_else(|| Error::from_reason("Addon path has no parent"))?;

    let path = Pdfium::pdfium_platform_library_name_at_path(dir);

    let pdfium = Pdfium::new(
        Pdfium::bind_to_library(&path)
            .map_err(|e| Error::from_reason(format!("Could not load PDFium: {e}")))?,
    );

    let document = pdfium
        .load_pdf_from_byte_vec(bytes.to_vec(), None)
        .map_err(|e| Error::from_reason(format!("Failed to load PDF: {e:?}")))?;

    let page = document
        .pages()
        .get(0)
        .map_err(|e| Error::from_reason(format!("Failed to get first page: {e:?}")))?;

    let page_size = page.page_size();
    let width_px = ((page_size.width().value / POINTS_PER_INCH) * RENDER_DPI).round() as i32;
    let height_px = ((page_size.height().value / POINTS_PER_INCH) * RENDER_DPI).round() as i32;

    let render_config = PdfRenderConfig::new()
        .set_target_width(width_px)
        .set_maximum_height(height_px)
        .rotate_if_landscape(PdfPageRenderRotation::Degrees90, true);

    let dyn_img = page
        .render_with_config(&render_config)
        .map_err(|e| Error::from_reason(format!("Render error: {e:?}")))?
        .as_image()
        .map_err(|e| Error::from_reason(format!("Render image error: {e:?}")))?;

    let mut buf = Vec::new();
    dyn_img
        .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| Error::from_reason(format!("Image encode error: {e:?}")))?;

    Ok(Buffer::from(buf))
}
