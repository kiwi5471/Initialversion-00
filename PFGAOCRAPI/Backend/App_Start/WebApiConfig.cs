/*
using System;
using System.Web.Http;

namespace PFGAOCRAPI
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            // 啟用屬性路由 (Attribute Routing)
            // 這讓控制器可以使用 [RoutePrefix("PAFOCUS/ocr")]
            config.MapHttpAttributeRoutes();

            // 預設路由配置
            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );
        }
    }
}
*/
