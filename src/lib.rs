use napi::bindgen_prelude::*;
use napi_derive::napi;
use pdfium_render::prelude::*;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
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

/// PDFium can only be bound once per process, so the instance is shared by every call.
static PDFIUM: OnceLock<Pdfium> = OnceLock::new();
static PDFIUM_INIT: Mutex<()> = Mutex::new(());

fn pdfium(library_path: &Path) -> Result<&'static Pdfium> {
    if let Some(pdfium) = PDFIUM.get() {
        return Ok(pdfium);
    }
    let _guard = PDFIUM_INIT
        .lock()
        .map_err(|_| Error::from_reason("PDFium initialization lock poisoned"))?;
    if let Some(pdfium) = PDFIUM.get() {
        return Ok(pdfium);
    }
    let bindings = Pdfium::bind_to_library(library_path)
        .map_err(|e| Error::from_reason(format!("Could not load PDFium: {e}")))?;
    Ok(PDFIUM.get_or_init(|| Pdfium::new(bindings)))
}

fn render_first_page_to_png(library_path: &Path, bytes: Vec<u8>) -> Result<Vec<u8>> {
    let pdfium = pdfium(library_path)?;

    let document = pdfium
        .load_pdf_from_byte_vec(bytes, None)
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

    Ok(buf)
}

/// Renders the first page of a PDF on the libuv thread pool.
pub struct PdfToPng {
    library_path: PathBuf,
    bytes: Option<Vec<u8>>,
}

impl Task for PdfToPng {
    type Output = Vec<u8>;
    type JsValue = Buffer;

    fn compute(&mut self) -> Result<Self::Output> {
        let bytes = self
            .bytes
            .take()
            .ok_or_else(|| Error::from_reason("PDF bytes were already consumed"))?;
        render_first_page_to_png(&self.library_path, bytes)
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(Buffer::from(output))
    }
}

/// Renders the first page of a PDF to PNG at 144 DPI without blocking the JS thread.
///
/// # Errors
///
/// Fails if the addon path cannot be resolved; loading or rendering errors reject the returned promise.
#[napi(ts_return_type = "Promise<Buffer>")]
pub fn pdf_to_png(env: Env, bytes: Buffer) -> Result<AsyncTask<PdfToPng>> {
    let module_path = module_path_as_fs_path(env)?;

    let dir = module_path
        .parent()
        .ok_or_else(|| Error::from_reason("Addon path has no parent"))?;

    Ok(AsyncTask::new(PdfToPng {
        library_path: Pdfium::pdfium_platform_library_name_at_path(dir),
        bytes: Some(bytes.to_vec()),
    }))
}
