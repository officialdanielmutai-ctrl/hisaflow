import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  /** Optional thread id; an unknown id starts a fresh conversation. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversationId?: string;
}
