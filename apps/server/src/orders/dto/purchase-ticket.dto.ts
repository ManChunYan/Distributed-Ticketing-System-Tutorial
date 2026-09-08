import { IsUUID } from 'class-validator';

export class PurchaseTicketDto {
  @IsUUID()
  userId: string;
}
