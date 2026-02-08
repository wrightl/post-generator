using FluentValidation;
using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Validators;

public class PublishGeneratedSeriesRequestValidator : AbstractValidator<PublishGeneratedSeriesRequest>
{
    public PublishGeneratedSeriesRequestValidator()
    {
        RuleFor(x => x.TopicDetail).NotEmpty().MaximumLength(10_000);
        RuleFor(x => x.NumPosts).InclusiveBetween(1, 90);
        RuleFor(x => x.Platform)
            .NotEmpty()
            .Must(v => Enum.TryParse<PostPlatform>(v, true, out _))
            .WithMessage("Platform must be one of: LinkedIn, Skool, Instagram, Bluesky, Facebook, TikTok");
        RuleFor(x => x.TikTokScriptDurationSeconds).InclusiveBetween(15, 180).When(x => x.TikTokScriptDurationSeconds.HasValue);
        RuleFor(x => x.GeneratedPosts)
            .NotEmpty()
            .WithMessage("At least one generated post is required.");
        RuleFor(x => x)
            .Must(req => req.GeneratedPosts.Count == req.NumPosts)
            .When(x => x.GeneratedPosts.Count > 0)
            .WithMessage("GeneratedPosts count must match NumPosts.");
        RuleForEach(x => x.GeneratedPosts).ChildRules(post =>
        {
            post.RuleFor(p => p.Content).NotEmpty().MaximumLength(10_000);
        });
    }
}
