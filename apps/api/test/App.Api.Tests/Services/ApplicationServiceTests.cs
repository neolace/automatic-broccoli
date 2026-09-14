using App.Api.Auth;
using App.Api.Errors;
using App.Api.Models;
using App.Api.Repositories;
using App.Api.Services;
using Xunit;

namespace App.Api.Tests.Services;

public class ApplicationServiceTests
{
    private static AuthContext BuildAuth(string userId = "user-1") =>
        new(userId, "tenant-1", ["access_as_user"], [], "Display Name");

    [Fact]
    public async Task CreateAsync_rejects_a_missing_name()
    {
        var service = new ApplicationService(new InMemoryApplicationRepository());

        var error = await Assert.ThrowsAsync<ValidationException>(
            () => service.CreateAsync(BuildAuth(), new CreateApplicationRequest(null, null)));

        Assert.Contains("name", error.Details!.Keys);
    }

    [Fact]
    public async Task CreateAsync_rejects_a_name_that_is_too_long()
    {
        var service = new ApplicationService(new InMemoryApplicationRepository());
        var longName = new string('a', 201);

        await Assert.ThrowsAsync<ValidationException>(
            () => service.CreateAsync(BuildAuth(), new CreateApplicationRequest(longName, null)));
    }

    [Fact]
    public async Task CreateAsync_stores_the_record_owned_by_the_caller()
    {
        var service = new ApplicationService(new InMemoryApplicationRepository());

        var record = await service.CreateAsync(BuildAuth("user-1"), new CreateApplicationRequest("My App", "desc"));

        Assert.Equal("My App", record.Name);
        Assert.Equal("user-1", record.OwnerId);
        Assert.NotEmpty(record.Id);
    }

    [Fact]
    public async Task ListForCurrentUserAsync_only_returns_records_owned_by_the_caller()
    {
        var repository = new InMemoryApplicationRepository();
        var service = new ApplicationService(repository);

        await service.CreateAsync(BuildAuth("user-1"), new CreateApplicationRequest("Owned by user 1", null));
        await service.CreateAsync(BuildAuth("user-2"), new CreateApplicationRequest("Owned by user 2", null));

        var items = await service.ListForCurrentUserAsync(BuildAuth("user-1"));

        Assert.Single(items);
        Assert.Equal("Owned by user 1", items[0].Name);
    }
}
