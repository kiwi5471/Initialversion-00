Imports System.Web.Http
Imports System.Web.Http.Cors

Public Module WebApiConfig
    Public Sub Register(ByVal config As HttpConfiguration)
        ' 啟用 CORS (允許前端 localhost 開發測試)
        ' 明確宣告為 EnableCorsAttribute 以排除 VB.NET 的多載解析問題
        Dim cors As New EnableCorsAttribute("*", "*", "*")
        config.EnableCors(cors)

        ' 確保支援 JSON 格式化（自動處理物件轉換）
        Dim json = config.Formatters.JsonFormatter
        json.SerializerSettings.PreserveReferencesHandling = Newtonsoft.Json.PreserveReferencesHandling.None
        config.Formatters.Remove(config.Formatters.XmlFormatter)

        ' 啟用屬性路由
        config.MapHttpAttributeRoutes()

        ' 預設路由配置
        config.Routes.MapHttpRoute(
            name:="DefaultApi",
            routeTemplate:="api/{controller}/{id}",
            defaults:=New With {.id = RouteParameter.Optional}
        )
    End Sub
End Module
