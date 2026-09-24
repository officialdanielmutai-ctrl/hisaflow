import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class ReorderProvidersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedModelIds!: string[];
}
