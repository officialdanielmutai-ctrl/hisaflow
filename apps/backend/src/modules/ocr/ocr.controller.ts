import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { AiIngestionService } from '../ai-ingestion/ai-ingestion.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

/** Shared upload validation for every OCR entry point. */
const imageFilePipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({
    fileType: /(jpg|jpeg|png)$/i,
  })
  .addMaxSizeValidator({
    maxSize: 5 * 1024 * 1024, // 5MB
  })
  .build({
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  });

@UseGuards(ClerkAuthGuard)
@Controller('ocr')
export class OcrController {
  constructor(
    private readonly ocrService: OcrService,
    private readonly aiIngestion: AiIngestionService,
  ) {}

  /** Raw OCR text only (kept for backwards compatibility). */
  @Post('receipt')
  @UseInterceptors(FileInterceptor('image'))
  async extractReceipt(
    @UploadedFile(imageFilePipe) file: Express.Multer.File,
    @OrgContext() orgId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    return this.ocrService.extractTextFromImage(file.buffer, file.mimetype);
  }

  /**
   * One round trip for the full pipeline: OCR the image, then feed the text
   * straight into AI ingestion. Doing both server-side removes a client→server
   * hop, and lets the inventory context be fetched *while* the vision model
   * runs instead of after it. Callers that only need the raw text (or want to
   * show it before parsing) can still use `POST /ocr/receipt`.
   */
  @Post('receipt/parse')
  @UseInterceptors(FileInterceptor('image'))
  async extractAndParse(
    @UploadedFile(imageFilePipe) file: Express.Multer.File,
    @OrgContext() orgId: string,
    @Body('source') source?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const parseSource = source === 'LABEL_OCR' ? 'LABEL_OCR' : 'RECEIPT_OCR';

    // Overlap the (cheap) DB context fetch with the (slow) vision call.
    const warmContext = this.aiIngestion.warmInventoryContext(orgId);
    const { text } = await this.ocrService.extractTextFromImage(file.buffer, file.mimetype);
    await warmContext;

    if (!text.trim()) {
      return { text: '', actions: [] };
    }

    const actions = await this.aiIngestion.parseInventoryText(text, orgId, parseSource);
    return { text, actions };
  }
}
