import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class FreezeAccountDto {
  @IsNotEmpty({ message: 'A reason must be provided for freezing or unfreezing an account' })
  @IsString()
  @MinLength(5, { message: 'Reason must be at least 5 characters explaining the administrative action' })
  reason!: string;
}
