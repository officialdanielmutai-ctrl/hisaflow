import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { NoteImportance, NoteStatus } from './create-note.dto';

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(NoteImportance)
  importance?: NoteImportance;

  @IsOptional()
  @IsEnum(NoteStatus)
  status?: NoteStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
