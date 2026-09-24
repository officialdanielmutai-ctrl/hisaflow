import { IsNotEmpty, IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateProviderDto {
  @IsNotEmpty({ message: 'Model alias name is required (e.g. "gemini-2.5-flash")' })
  @IsString()
  modelName!: string;

  @IsNotEmpty({ message: 'Provider platform name is required (e.g. "google", "anthropic", "openai")' })
  @IsString()
  provider!: string;

  @IsNotEmpty({ message: 'LiteLLM full model identifier is required (e.g. "gemini/gemini-2.5-flash")' })
  @IsString()
  litellmModelId!: string;

  @IsNotEmpty({ message: 'API key is required' })
  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;
}
