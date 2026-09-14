using App.Api.Models;

namespace App.Api.Repositories;

/// <summary>
/// Encapsulates storage access so handlers and services never talk to a
/// downstream store directly, giving tests a clean seam for mocking.
/// </summary>
public interface IApplicationRepository
{
    Task<ApplicationRecord> AddAsync(ApplicationRecord record, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ApplicationRecord>> ListByOwnerAsync(string ownerId, CancellationToken cancellationToken = default);
}
