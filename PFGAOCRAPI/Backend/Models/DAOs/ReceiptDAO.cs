/*
using System;
using System.Data.SqlClient;
using System.Configuration;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using PFGAOCRAPI.Models.Infors;

namespace PFGAOCRAPI.Models.DAOs
{
    public class ReceiptDAO
    {
        private readonly string _connString = ConfigurationManager.ConnectionStrings["OCRDb"]?.ConnectionString;

        /// <summary>
        /// 仿照 PFFAAPI 模式，使用呼叫元件（COM Object）將資料寫進資料庫
        /// </summary>
        public string SaveOCRToLegacySystem(ReceiptInfor data, string varCompany, string manno, string buno, string dept)
        {
            string msg = "";
            object obj2210 = null;
            try
            {
                // 【測試模式】如果找不到元件，模擬成功回傳 (本地端測試專用)
                Type comType = Type.GetTypeFromProgID("PFFA2210.CFFA2211");
                if (comType == null) 
                {
                    // 若在本地開發環境，模擬成功的 RC = "0"
                    System.Diagnostics.Debug.WriteLine("DEBUG: Component PFFA2210.CFFA2211 not found, using Mock Success.");
                    return "0"; 
                }

                obj2210 = Activator.CreateInstance(comType);

                // 2. 格式化資料：手動轉成二維 Variant 陣列 (仿 PFFAAPI 模式)
                // 建立一個 25x1 的二維陣列 (對應 TFGAOCRV 的 25 個欄位，單筆記錄)
                object[,] fldArray = new object[25, 1];

                fldArray[0, 0] = data.DOC_ID;
                fldArray[1, 0] = data.FILE_NAME;
                fldArray[2, 0] = data.FILE_PATH;
                fldArray[3, 0] = data.UPLOAD_DATE;
                fldArray[4, 0] = data.UPLOAD_USER;
                fldArray[5, 0] = data.DEPT;
                fldArray[6, 0] = data.VOUCHER_TYPE;
                fldArray[7, 0] = data.INVOICE_TYPE;
                fldArray[8, 0] = data.INVOICE_NO;
                fldArray[9, 0] = data.INVOICE_DATE;
                fldArray[10, 0] = data.SELLER_NAME;
                fldArray[11, 0] = data.SELLER_TAX_ID;
                fldArray[12, 0] = data.BUYER_NAME;
                fldArray[13, 0] = data.BUYER_TAX_ID;
                fldArray[14, 0] = data.ITEM_DESC;
                fldArray[15, 0] = data.QTY;
                fldArray[16, 0] = data.UNIT_PRICE;
                fldArray[17, 0] = data.AMT;
                fldArray[18, 0] = data.REMARK;
                fldArray[19, 0] = data.AMT_BEFORE_TAX;
                fldArray[20, 0] = data.TAX_AMT;
                fldArray[21, 0] = data.AMT_TOTAL;
                fldArray[22, 0] = data.TAX_TYPE;
                fldArray[23, 0] = data.EXPENSE_TYPE;
                fldArray[24, 0] = data.ACCOUNT_CODE;

                string kind = "OCR"; // 自定義類別

                // 3. 呼叫元件方法 (仿 RC = Obj2210.PDA_UPLOAD(...))
                // 直接傳入二維陣列，COM 元件會將其識別為 Variant 陣列
                dynamic comObj = obj2210;
                string rc = comObj.PDA_UPLOAD(varCompany, kind, manno, buno, dept, fldArray, ref msg);

                return rc; // 回傳 RC
            }
            catch (Exception ex)
            {
                return "Exception: " + ex.Message;
            }
            finally
            {
                // 4. 資源釋放 (仿 Finally ReleaseComObject)
                if (obj2210 != null)
                {
                    Marshal.ReleaseComObject(obj2210);
                }
            }
        }

        public bool InsertReceiptRecord(ReceiptInfor data)
        {
            if (string.IsNullOrEmpty(_connString)) return false;

            using (SqlConnection conn = new SqlConnection(_connString))
            {
                conn.Open();
                using (SqlTransaction trans = conn.BeginTransaction())
                {
                    try {
                        // 寫入 TFGAOCRV 資料表
                        string sql = @"INSERT INTO TFGAOCRV (
                            DOC_ID, FILE_NAME, FILE_PATH, UPLOAD_DATE, UPLOAD_USER, DEPT, 
                            VOUCHER_TYPE, INVOICE_TYPE, INVOICE_NO, INVOICE_DATE, 
                            SELLER_NAME, SELLER_TAX_ID, BUYER_NAME, BUYER_TAX_ID, 
                            ITEM_DESC, QTY, UNIT_PRICE, AMT, REMARK, 
                            AMT_BEFORE_TAX, TAX_AMT, AMT_TOTAL, TAX_TYPE, 
                            EXPENSE_TYPE, ACCOUNT_CODE
                        ) VALUES (
                            @DOC_ID, @FILE_NAME, @FILE_PATH, @UPLOAD_DATE, @UPLOAD_USER, @DEPT, 
                            @VOUCHER_TYPE, @INVOICE_TYPE, @INVOICE_NO, @INVOICE_DATE, 
                            @SELLER_NAME, @SELLER_TAX_ID, @BUYER_NAME, @BUYER_TAX_ID, 
                            @ITEM_DESC, @QTY, @UNIT_PRICE, @AMT, @REMARK, 
                            @AMT_BEFORE_TAX, @TAX_AMT, @AMT_TOTAL, @TAX_TYPE, 
                            @EXPENSE_TYPE, @ACCOUNT_CODE
                        )";
                        
                        using (SqlCommand cmd = new SqlCommand(sql, conn, trans)) {
                            cmd.Parameters.AddWithValue("@DOC_ID", (object)data.DOC_ID ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@FILE_NAME", (object)data.FILE_NAME ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@FILE_PATH", (object)data.FILE_PATH ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@UPLOAD_DATE", (object)data.UPLOAD_DATE ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@UPLOAD_USER", (object)data.UPLOAD_USER ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@DEPT", (object)data.DEPT ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@VOUCHER_TYPE", (object)data.VOUCHER_TYPE ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@INVOICE_TYPE", (object)data.INVOICE_TYPE ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@INVOICE_NO", (object)data.INVOICE_NO ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@INVOICE_DATE", (object)data.INVOICE_DATE ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@SELLER_NAME", (object)data.SELLER_NAME ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@SELLER_TAX_ID", (object)data.SELLER_TAX_ID ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@BUYER_NAME", (object)data.BUYER_NAME ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@BUYER_TAX_ID", (object)data.BUYER_TAX_ID ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@ITEM_DESC", (object)data.ITEM_DESC ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@QTY", data.QTY);
                            cmd.Parameters.AddWithValue("@UNIT_PRICE", data.UNIT_PRICE);
                            cmd.Parameters.AddWithValue("@AMT", data.AMT);
                            cmd.Parameters.AddWithValue("@REMARK", (object)data.REMARK ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@AMT_BEFORE_TAX", data.AMT_BEFORE_TAX);
                            cmd.Parameters.AddWithValue("@TAX_AMT", data.TAX_AMT);
                            cmd.Parameters.AddWithValue("@AMT_TOTAL", data.AMT_TOTAL);
                            cmd.Parameters.AddWithValue("@TAX_TYPE", (object)data.TAX_TYPE ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@EXPENSE_TYPE", (object)data.EXPENSE_TYPE ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@ACCOUNT_CODE", (object)data.ACCOUNT_CODE ?? DBNull.Value);
                            
                            cmd.ExecuteNonQuery();
                        }
                        
                        trans.Commit();
                        return true;
                    } catch { trans.Rollback(); throw; }
                }
            }
        }
    }
}
*/
