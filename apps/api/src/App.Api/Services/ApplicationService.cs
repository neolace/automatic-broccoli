using App.Api.Auth;
using App.Api.Errors;
using App.Api.Models;
using App.Api.Repositories;

namespace App.Api.Services;

/// <summary>
/// Business rules for the application resource, independent of AWS event
/// plumbing so they stay easy to reason about and to unit test.
/// </summary>
public sealed class ApplicationService(IApplicationRepository repository)
{
    private const int MaxNameLength = 200;
    private const int MaxDescriptionLength = 2000;

    public async Task<ApplicationRecord> CreateAsync(
        AuthContext auth,
        CreateApplicationRequest request,
        CancellationToken cancellationToken = default)
    {
        Authorization.RequireScope(auth, "access_as_user");

        var name = request.Name?.Trim();
        var details = new Dictionary<string, string>();

        if (string.IsNullOrEmpty(name))
        {
            details["name"] = "Name is required.";
        }
        else if (name.Length > MaxNameLength)
        {
            details["name"] = $"Name must be {MaxNameLength} characters or fewer.";
        }

        if (request.Description is { Length: > MaxDescriptionLength })
        {
            details["description"] = $"Description must be {MaxDescriptionLength} characters or fewer.";
        }

        if (details.Count > 0)
        {
            throw new ValidationException("The request failed validation.", details);
        }

        var record = new ApplicationRecord(
            Id: Guid.NewGuid().ToString(),
            Name: name!,
            Description: request.Description?.Trim(),
            OwnerId: auth.UserId,
            CreatedAt: DateTimeOffset.UtcNow.ToString("O"));

        return await repository.AddAsync(record, cancellationToken);
    }

    public async Task<IReadOnlyList<ApplicationRecord>> ListForCurrentUserAsync(
        AuthContext auth,
        CancellationToken cancellationToken = default)
    {
        Authorization.RequireScope(auth, "access_as_user");
        return await repository.ListByOwnerAsync(auth.UserId, cancellationToken);
    }
}
