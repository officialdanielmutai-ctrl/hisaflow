import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { BookingStatus } from '../../../../generated/prisma/client';

export class UpdateBookingDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsDateString()
  @IsOptional()
  checkInDate?: string;

  @IsDateString()
  @IsOptional()
  checkOutDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
