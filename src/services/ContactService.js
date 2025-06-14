// src/services/ContactService.js
import { createReadStream, existsSync, unlinkSync } from 'fs';
import fs from 'fs/promises';
import csv from 'csv-parser';
import XLSX from 'xlsx';
import path from 'path';
import { ensureDirectoryExists } from '../utils/fileUtils.js';

export class ContactService {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.CONTACTS_FILE = path.join(rootDir, 'contacts.xlsx');
    this.MESSAGE_FILE = path.join(rootDir, 'message', 'message.json');
    this.ASSETS_DIR = path.join(rootDir, 'assets');
  }

  async initializeContactsFile() {
    if (!existsSync(this.CONTACTS_FILE)) {
      this.writeContactsToExcel([]);
      console.log('Created empty contacts file');
    }
  }

  readContactsFromExcel() {
    if (!existsSync(this.CONTACTS_FILE)) return [];

    const workbook = XLSX.readFile(this.CONTACTS_FILE, { type: "file", raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    return data.map((entry) => ({
      phone: String(entry.phone).trim(),
      name: entry.name && String(entry.name).trim() !== "" ? String(entry.name).trim() : null,
      sent: entry.sent
    }));
  }

  writeContactsToExcel(contacts) {
    const normalizedContacts = contacts.map((contact) => {
      const nameKey = Object.keys(contact).find((key) => key.trim().toLowerCase() === 'name');
      return {
        phone: String(contact.phone).trim(),
        name: nameKey && contact[nameKey]?.toString().trim() !== '' ? contact[nameKey].toString().trim() : 'NULL',
        sent: false
      };
    });
    
    const worksheet = XLSX.utils.json_to_sheet(normalizedContacts);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    XLSX.writeFile(workbook, this.CONTACTS_FILE);
  }

  updateContactStatusInExcel(updatedContacts, newStatus) {
    if (!existsSync(this.CONTACTS_FILE)) {
      console.error('File does not exist:', this.CONTACTS_FILE);
      return;
    }

    const workbook = XLSX.readFile(this.CONTACTS_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const existingContacts = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const updatedMap = new Map(
      updatedContacts.map(contact => [String(contact.phone).trim(), true])
    );

    const updatedSheetData = existingContacts.map((contact) => {
      const phone = String(contact.phone).trim();
      return {
        ...contact,
        sent: newStatus
      };
    });

    const newWorksheet = XLSX.utils.json_to_sheet(updatedSheetData);
    workbook.Sheets[sheetName] = newWorksheet;
    XLSX.writeFile(workbook, this.CONTACTS_FILE);
  }

  async readContactsFromCSV(filepath) {
    return new Promise((resolve, reject) => {
      const contacts = [];
      createReadStream(filepath)
        .pipe(csv())
        .on('data', (row) => {
          let phone = '';
          let name = '';

          // Normalize and extract phone number
          if (row.phone && typeof row.phone === 'object') {
            phone = row.phone.phone || '';
          } else if (row.phone && typeof row.phone === 'string') {
            phone = row.phone.trim();
          } else {
            for (const key in row) {
              const value = row[key];
              if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
                phone = value.trim();
                break;
              }
            }
          }

          // Normalize and extract name (case-insensitive search)
          const nameKey = Object.keys(row).find((key) => key.trim().toLowerCase() === 'name');
          if (nameKey && row[nameKey]?.toString().trim() !== '') {
            name = row[nameKey].toString().trim();
          } else {
            name = 'NULL';
          }

          // Only push if phone is found
          if (phone) {
            contacts.push({
              phone,
              name,
              sent: false,
            });
          }
        })
        .on('end', () => {
          console.log(`CSV processing complete. Found ${contacts.length} contacts.`);
          resolve(contacts);
        })
        .on('error', (error) => {
          console.error('Error reading CSV:', error);
          reject(error);
        });
    });
  }

  async processContactsFile(csvFilePath) {
    const newContacts = await this.readContactsFromCSV(csvFilePath);
    
    let existingContacts = [];
    if (existsSync(this.CONTACTS_FILE)) {
      existingContacts = this.readContactsFromExcel();
    }
    
    const existingNumbers = new Set(existingContacts.map(contact => contact.phone));
    
    // Filter out duplicates
    const uniqueNewContacts = newContacts.filter(contact => !existingNumbers.has(contact.phone));
    const repeatedContacts = newContacts.filter(contact => existingNumbers.has(contact.phone));
    
    // Combine existing contacts with unique new contacts
    const updatedContacts = [...existingContacts, ...uniqueNewContacts];
    
    // Write the updated contacts back to the Excel file
    this.writeContactsToExcel(updatedContacts);
    
    // Mark reappeared numbers as true
    this.updateContactStatusInExcel(repeatedContacts, true);

    return {
      newContactsAdded: uniqueNewContacts.length,
      repeatedContacts: repeatedContacts.length
    };
  }

  async saveMedia(mediaFile) {
    await ensureDirectoryExists(this.ASSETS_DIR);
    
    const fileExt = path.extname(mediaFile.originalname);
    const newFilePath = path.join(this.ASSETS_DIR, 'Promo' + fileExt);
    
    await fs.rename(mediaFile.path, newFilePath);
    console.log('Media upload successful');
    
    return newFilePath;
  }

  async getLatestMediaPath() {
    try {
      await ensureDirectoryExists(this.ASSETS_DIR);
      const files = await fs.readdir(this.ASSETS_DIR);
      
      if (files.length > 0) {
        const fileStats = await Promise.all(
          files.map(async file => {
            const filePath = path.join(this.ASSETS_DIR, file);
            const stats = await fs.stat(filePath);
            return { file, stats };
          })
        );
        
        const mostRecent = fileStats.sort((a, b) => b.stats.mtime - a.stats.mtime)[0];
        return path.join(this.ASSETS_DIR, mostRecent.file);
      }
    } catch (err) {
      console.error('Error finding media file:', err);
    }
    
    return '';
  }

  async storeCustomDetails(salutation, message) {
    try {
      await ensureDirectoryExists(path.join(this.rootDir, 'message'));
      const messageData = {
        salutation: salutation || "",
        message: message || ""
      };
      
      await fs.writeFile(this.MESSAGE_FILE, JSON.stringify(messageData, null, 2), 'utf-8');
      console.log('Message successfully saved.');
      return true;
    } catch (error) {
      console.error('Error handling the file:', error);
      return false;
    }
  }

  // Add the missing readMessageData method
  async readMessageData() {
    try {
      if (!existsSync(this.MESSAGE_FILE)) {
        return { salutation: "", message: "" };
      }
      
      const data = await fs.readFile(this.MESSAGE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading message data:', error);
      return { salutation: "", message: "" };
    }
  }

  async clearData(contacts, media) {
    const results = {
      contactsCleared: false,
      mediaDeleted: false,
      messages: []
    };

    // Mark all contacts as false (unsent)
    if (contacts === true) {
      try {
        const existingContacts = this.readContactsFromExcel();
        this.updateContactStatusInExcel(existingContacts, false);
        results.contactsCleared = true;
        results.messages.push('All contacts marked as unsent');
        console.log('All contacts marked as unsent');
      } catch (error) {
        results.messages.push('Error clearing contacts: ' + error.message);
        console.error('Error clearing contacts:', error.message);
      }
    }

    // Delete media file when media is true
    if (media === true) {
      try {
        const files = await fs.readdir(this.ASSETS_DIR);
        
        if (files.length > 0) {
          for (const file of files) {
            const filePath = path.join(this.ASSETS_DIR, file);
            await fs.unlink(filePath);
            console.log(`${file} deleted successfully`);
          }
          results.mediaDeleted = true;
          results.messages.push('All media files deleted from assets directory');
        } else {
          results.messages.push('No media files found to delete');
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          results.messages.push('Assets directory not found');
          console.log('Assets directory not found');
        } else {
          results.messages.push('Error deleting media: ' + error.message);
          console.error('Error deleting media:', error.message);
        }
      }
    }

    return results;
  }
}