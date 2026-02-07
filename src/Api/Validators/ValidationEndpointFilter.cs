using FluentValidation;

namespace PostGenerator.Api.Validators;

public class ValidationFilter<T> : IEndpointFilter where T : class
{
    private readonly IValidator<T>? _validator;

    public ValidationFilter(IValidator<T>? validator = null)
    {
        _validator = validator;
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (_validator == null)
            return await next(context);

        var arg = context.Arguments.OfType<T>().FirstOrDefault();
        if (arg == null)
            return await next(context);

        var result = await _validator.ValidateAsync(arg, context.HttpContext.RequestAborted);
        if (result.IsValid)
            return await next(context);

        var errors = result.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
        return Results.ValidationProblem(new Dictionary<string, string[]>(errors));
    }
}
