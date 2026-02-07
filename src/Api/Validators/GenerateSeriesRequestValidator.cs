using FluentValidation;
using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Validators;

public class GenerateSeriesRequestValidator : AbstractValidator<GenerateSeriesRequest>
{
    public GenerateSeriesRequestValidator()
    {
        RuleFor(x => x.TopicDetail).NotEmpty().MaximumLength(10_000);
        RuleFor(x => x.NumPosts).InclusiveBetween(1, 20);
        RuleFor(x => x.Platform)
            .NotEmpty()
            .Must(v => Enum.TryParse<PostPlatform>(v, true, out _))
            .WithMessage("Platform must be one of: LinkedIn, Skool, Instagram, Bluesky, Facebook, TikTok");
        RuleFor(x => x.TikTokScriptDurationSeconds).InclusiveBetween(15, 180).When(x => x.TikTokScriptDurationSeconds.HasValue);
    }
}
