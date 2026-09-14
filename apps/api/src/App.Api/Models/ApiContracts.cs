namespace App.Api.Models;

/// <summary>
/// HTTP contract between the SPA and the Lambda API. Kept in parity with
/// packages/shared/src/api-contracts.ts since the two applications no longer
/// share a compiler -- see docs/api.md for the cross-language contract note.
/// </summary>
public sealed record HealthResponse(string Status, string Timestamp);

/// <summary>
/// Allow-listed identity projection returned by GET /api/me. Only stable
/// identifiers and presentation data are returned; the raw token and the full
/// claim set are never echoed back to the browser.
/// </summary>
public sealed record MeResponse(
    string UserId,
    string TenantId,
    IReadOnlyList<string> Scopes,
    IReadOnlyList<string> Roles,
    string? DisplayName);

public sealed record ApplicationRecord(
    string Id,
    string Name,
    string? Description,
    string OwnerId,
    string CreatedAt);

public sealed record CreateApplicationRequest(string? Name, string? Description);

public sealed record ListApplicationsResponse(IReadOnlyList<ApplicationRecord> Items);

public sealed record ApiErrorDetail(
    string Code,
    string Message,
    string CorrelationId,
    IReadOnlyDictionary<string, string>? Details);

public sealed record ApiErrorBody(ApiErrorDetail Error);
