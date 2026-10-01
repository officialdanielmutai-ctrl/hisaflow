import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { SubscriptionPaymentMethod } from '@prisma/client';

export class ChangePaymentMethodDto {
  @IsEnum(SubscriptionPaymentMethod)
  method!: SubscriptionPaymentMethod;

  /** Required when the target method is MPESA (first or replacement number). */
  @IsOptional()
  @IsString()
  @Matches(/^(\+?254|0)(7|1)\d{8}$/, {
    message: 'mpesaPhone must be a valid Kenyan M-Pesa number',
  })
  mpesaPhone?: string;
}
