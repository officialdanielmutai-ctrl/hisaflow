import { IsString, IsNotEmpty, IsDateString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsString()
  @IsNotEmpty()
  guestId!: string;

  @IsDateString()
  @IsNotEmpty()
  checkInDate!: string;

  @IsDateString()
  @IsNotEmpty()
  checkOutDate!: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  ratePerNight?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
