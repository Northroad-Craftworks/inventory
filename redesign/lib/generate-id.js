import { randomBytes } from 'crypto';

export default function generateId(){
    return Buffer.from(randomBytes(8)).toString('hex');
}