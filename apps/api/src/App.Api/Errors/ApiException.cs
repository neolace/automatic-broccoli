namespace App.Api.Errors;

/// <summary>
/// Base class for errors the handler layer knows how to translate into an
/// HTTP response. Anything else is treated as an unexpected internal error
/// and never leaks its message to the caller.
/// </summary>
public abstract class ApiException : Exception
{
    protected ApiException(string code, int statusCode, string message, IReadOnlyDictionary<string, string>? details = null)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        Details = details;
    }

    public string Code { get; }

    public int StatusCode { get; }

    public IReadOnlyDictionary<string, string>? Details { get; }
}

public sealed class ValidationException(string message, IReadOnlyDictionary<string, string>? details = null)
    : ApiException("VALIDATION_ERROR", 400, message, details);

/// <summary>The token lacked a required claim, or was otherwise unusable.</summary>
public sealed class UnauthorizedException(string message = "Authentication is required.")
    : ApiException("UNAUTHORIZED", 401, message);

/// <summary>The caller is authenticated but not permitted to perform this operation.</summary>
public sealed class ForbiddenException(string message = "You do not have permission to perform this action.")
    : ApiException("FORBIDDEN", 403, message);

public sealed class NotFoundException(string message = "The requested resource was not found.")
    : ApiException("NOT_FOUND", 404, message);

public sealed class ConflictException(string message) : ApiException("CONFLICT", 409, message);
