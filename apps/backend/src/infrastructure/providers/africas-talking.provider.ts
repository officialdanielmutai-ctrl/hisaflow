import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AfricasTalkingProvider {
  constructor(private readonly configService: ConfigService) {}

  async sendSms(to: string, message: string): Promise<void> {
    const apiKey = this.configService.get<string>('africasTalking.apiKey');
    const username = this.configService.get<string>('africasTalking.username');
    if (!apiKey || !username) {
      console.error('Africa’s Talking credentials missing');
      return;
    }

    const url = 'https://api.africastalking.com/version1/messaging';
    const headers = new Headers();
    headers.set('apiKey', apiKey);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/x-www-form-urlencoded');

    const body = new URLSearchParams({
      username,
      to,
      message,
    });

    try {
      await fetch(url, { method: 'POST', headers, body });
    } catch (err) {
      console.error('Africa’s Talking SMS send failed:', err);
    }
  }
}
