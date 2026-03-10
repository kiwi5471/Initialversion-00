/*
using System;
using System.Collections.Generic;
using PFGAOCRAPI.Models.Infors;
using PFGAOCRAPI.Models.DAOs;
using Microsoft.AspNetCore.Mvc;

namespace PFGAOCRAPI.Controllers
{
    [ApiController]
    [Route("ocr")]
    public class OCRController : ControllerBase
    {
        private readonly ReceiptDAO _dao = new ReceiptDAO();

        /// <summary>處理批量 OCR 識別結果</summary>
        [HttpPost("batch-process")]
        public IActionResult BatchProcessOCR([FromBody] OCRBatchRequest request)
        {
            if (request?.items == null) return BadRequest("Invalid request data");

            var results = new List<object>();

            try
            {
                foreach (var item in request.items)
                {
                    var receipt = new ReceiptInfor
                    {
                        DOC_ID = Guid.NewGuid().ToString("N").Substring(0, 20),
                        FILE_NAME = item.scanned_filename,
                        FILE_PATH = item.file_path,
                        UPLOAD_DATE = DateTime.Now,
                        UPLOAD_USER = item.username,
                        INVOICE_NO = item.name,
                        INVOICE_DATE = DateTime.TryParse(item.date, out var d) ? d : (DateTime?)null,
                        SELLER_NAME = item.vendor,
                        SELLER_TAX_ID = item.tax_id,
                        AMT_BEFORE_TAX = decimal.TryParse(item.amount_without_tax, out var amt) ? amt : 0,
                        TAX_AMT = decimal.TryParse(item.tax_amount, out var tax) ? tax : 0,
                        AMT_TOTAL = decimal.TryParse(item.amount_with_tax, out var total) ? total : 0,
                        REMARK = $"Model: {item.model}"
                    };

                    _dao.InsertReceiptRecord(receipt);

                    string legacyRC = _dao.SaveOCRToLegacySystem(receipt, "Comp001", item.user_id, "Buno001", "Dept001");

                    results.Add(new { invoice_no = item.name, status = "Success", legacyRC });
                }

                return Ok(new { message = "Batch processing completed", details = results });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Batch processing error", detail = ex.Message });
                // 或 return Problem(ex.Message, statusCode: 500, title: "Batch processing error");
            }
        }

        [HttpPost("process")]
        public IActionResult SaveOCRResult([FromBody] ReceiptInfor receipt)
        {
            if (receipt == null) return BadRequest("No data provided");

            try
            {
                if (string.IsNullOrEmpty(receipt.DOC_ID))
                    receipt.DOC_ID = Guid.NewGuid().ToString("N").Substring(0, 20);

                bool isSaved = _dao.InsertReceiptRecord(receipt);
                string rc = _dao.SaveOCRToLegacySystem(receipt, "Comp001", "User001", "Buno001", "Dept001");

                return Ok(new { status = "Success", id = receipt.DOC_ID, legacyResult = rc, saved = isSaved });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Database save error", detail = ex.Message });
            }
        }
    }
}
*/