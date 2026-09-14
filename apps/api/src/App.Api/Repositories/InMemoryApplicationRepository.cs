using System.Collections.Concurrent;
using App.Api.Models;

namespace App.Api.Repositories;

/// <summary>
/// Reference in-memory implementation. Per docs/scope, a persistent store
/// (e.g. DynamoDB) is introduced only when there is a defined requirement;
/// this keeps the initial implementation simple and swappable behind
/// <see cref="IApplicationRepository"/>.
/// </summary>
public sealed class InMemoryApplicationRepository : IApplicationRepository
{
    private readonly ConcurrentDictionary<string, ApplicationRecord> _records = new();

    public Task<ApplicationRecord> AddAsync(ApplicationRecord record, CancellationToken cancellationToken = default)
    {
        _records[record.Id] = record;
        return Task.FromResult(record);
    }

    public Task<IReadOnlyList<ApplicationRecord>> ListByOwnerAsync(string ownerId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ApplicationRecord> items = _records.Values
            .Where(r => string.Equals(r.OwnerId, ownerId, StringComparison.Ordinal))
            .OrderBy(r => r.CreatedAt, StringComparer.Ordinal)
            .ToList();

        return Task.FromResult(items);
    }
}
