using Amazon.XRay.Recorder.Core;

namespace App.Api.Utils;

/// <summary>
/// Thin wrapper around AWS X-Ray that gracefully degrades when tracing is
/// unavailable (e.g. local development or unit tests). Every subsegment is
/// annotated with the route and HTTP method for filtering in the X-Ray
/// console and service map.
/// </summary>
public static class Tracing
{
    private static readonly bool Enabled =
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("AWS_XRAY_DAEMON_ADDRESS"))
        || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("_X_AMZN_TRACE_ID"));

    /// <summary>
    /// Executes <paramref name="action"/> inside an X-Ray subsegment.
    /// When tracing is not available the action runs directly.
    /// </summary>
    public static async Task<T> TraceAsync<T>(string name, string route, string method, Func<Task<T>> action)
    {
        if (!Enabled)
        {
            return await action();
        }

        AWSXRayRecorder.Instance.BeginSubsegment(name);
        try
        {
            AWSXRayRecorder.Instance.AddAnnotation("route", route);
            AWSXRayRecorder.Instance.AddAnnotation("method", method);
            var result = await action();
            return result;
        }
        catch (Exception ex)
        {
            AWSXRayRecorder.Instance.AddException(ex);
            throw;
        }
        finally
        {
            AWSXRayRecorder.Instance.EndSubsegment();
        }
    }
}
