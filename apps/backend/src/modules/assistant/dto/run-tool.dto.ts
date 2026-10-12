import { IsObject, IsOptional } from 'class-validator';

export class RunToolDto {
  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}
