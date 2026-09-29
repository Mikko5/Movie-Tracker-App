const {
    decodeBoxdId,
    parseCsvBuffer
} = require('../../src/core/LetterboxdUtils');

describe('LetterboxdUtils', () => {
    describe('decodeBoxdId', () => {
        it('should decode Base62 shortlinks correctly into Letterboxd numeric IDs', () => {
            expect(decodeBoxdId('https://boxd.it/c3eVFV')).toBe('1104148129');
            expect(decodeBoxdId('https://boxd.it/fn7BQp')).toBe('1408366198');
            expect(decodeBoxdId('https://boxd.it/5sRy03')).toBe('500716365');
        });

        it('should return null for empty or invalid URLs', () => {
            expect(decodeBoxdId('')).toBeNull();
            expect(decodeBoxdId(null)).toBeNull();
            expect(decodeBoxdId('https://boxd.it/!!!')).toBeNull();
        });
    });

    describe('parseCsvBuffer', () => {
        it('should parse CSV with quoted fields and special characters', async () => {
            const csvText = 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
                '2023-11-21,"Pepsi, Where\'s My Jet?",2022,https://boxd.it/5c2FoP,3,,,2022-12-01\n';
            const { headers, rows } = await parseCsvBuffer(csvText);
            expect(headers).toContain('Name');
            expect(headers).toContain('Watched Date');
            expect(rows).toHaveLength(1);
            expect(rows[0].Name).toBe("Pepsi, Where's My Jet?");
            expect(rows[0]['Watched Date']).toBe('2022-12-01');
        });
    });
});
