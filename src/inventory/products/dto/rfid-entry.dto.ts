export class RfidEntryItemDto {
  rfid_tag: string;
  expiration_date?: string;
}

export class RfidEntryDto {
  entries: RfidEntryItemDto[];
}
