import { IsString, IsNotEmpty, IsDateString, IsOptional, IsNumber } from 'class-validator';

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
  ratePerNight?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
