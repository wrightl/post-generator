# Build stage – build context is src/Api (set by azd)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files for restore (Api + referenced Core project)
# Using .. to access parent directory since build context is src/Api
COPY ../PostGenerator.slnx ./
COPY ../Core/Core.csproj Core/
COPY Api.csproj Api/
RUN dotnet restore Api/Api.csproj

# Copy full source and publish
COPY ../Core/ Core/
COPY . Api/
RUN dotnet publish Api/Api.csproj -c Release -o /app

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

# Container Apps expects the API on port 8080 (see infra/main.bicep targetPort)
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "Api.dll"]
