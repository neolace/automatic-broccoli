using App.Api.Utils;
using Xunit;

namespace App.Api.Tests.Utils;

public class CorrelationIdTests
{
    [Theory]
    [InlineData("3f2504e0-4f89-11d3-9a0c-0305e82c3301")]
    [InlineData("req_12345678")]
    public void IsValid_accepts_safe_identifiers(string value) =>
        Assert.True(CorrelationId.IsValid(value));

    [Theory]
    [InlineData("short")]
    [InlineData("has spaces here")]
    [InlineData(null)]
    public void IsValid_rejects_unsafe_or_missing_values(string? value) =>
        Assert.False(CorrelationId.IsValid(value));

    [Fact]
    public void IsValid_rejects_values_that_could_be_used_for_log_injection()
    {
        Assert.False(CorrelationId.IsValid("new\nline-0000000"));
        Assert.False(CorrelationId.IsValid(new string('x', 129)));
    }

    [Fact]
    public void Resolve_returns_the_client_supplied_id_when_valid()
    {
        var headers = new Dictionary<string, string> { [CorrelationId.HeaderName] = "req_abcdefgh" };

        Assert.Equal("req_abcdefgh", CorrelationId.Resolve(headers));
    }

    [Fact]
    public void Resolve_mints_a_new_id_when_the_header_is_missing_or_unsafe()
    {
        Assert.NotEmpty(CorrelationId.Resolve(null));
        Assert.NotEmpty(CorrelationId.Resolve(new Dictionary<string, string> { [CorrelationId.HeaderName] = "bad value" }));
    }

    [Fact]
    public void Resolve_is_case_insensitive_on_the_header_name()
    {
        var headers = new Dictionary<string, string> { ["X-Correlation-Id"] = "req_abcdefgh" };

        Assert.Equal("req_abcdefgh", CorrelationId.Resolve(headers));
    }
}
