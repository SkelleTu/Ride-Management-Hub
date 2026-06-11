import { db, usersTable, driverProfilesTable } from "./index";
import { eq } from "drizzle-orm";

export async function seedDefaultAccounts() {
  // Owner: vfdiogoseg@gmail.com / Victor.!.1999
  const ownerEmail = "vfdiogoseg@gmail.com";
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, ownerEmail));

  if (existing.length === 0) {
    const [owner] = await db.insert(usersTable).values({
      name: "Diogo Segura",
      email: ownerEmail,
      passwordHash: "d9784dd697fa23a4ff8b9d96fb36ac01cc306608e3a06cfef76375b8ee34ab1f",
      phone: "(11) 99999-0001",
      role: "admin",
      rating: 5.0,
      totalRides: 0,
    }).returning();

    await db.insert(driverProfilesTable).values({
      userId: owner.id,
      status: "approved",
      vehicleMake: "Fiat",
      vehicleModel: "Mobi",
      vehicleYear: 2024,
      vehicleColor: "Branco",
      vehiclePlate: "SYO6I37",
      vehicleType: "hatch",
      cpf: "000.000.000-00",
      cnhNumber: "00000000000",
      cnhCategory: "B",
    });
  } else {
    const owner = existing[0];
    const profiles = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, owner.id));
    if (profiles.length === 0) {
      await db.insert(driverProfilesTable).values({
        userId: owner.id,
        status: "approved",
        vehicleMake: "Fiat",
        vehicleModel: "Mobi",
        vehicleYear: 2024,
        vehicleColor: "Branco",
        vehiclePlate: "SYO6I37",
        vehicleType: "hatch",
        cpf: "000.000.000-00",
        cnhNumber: "00000000000",
        cnhCategory: "B",
      });
    }
  }

  // Test passenger: passageiro@teste.com / test123
  const passengerEmail = "passageiro@teste.com";
  const existingPassenger = await db.select().from(usersTable).where(eq(usersTable.email, passengerEmail));
  if (existingPassenger.length === 0) {
    await db.insert(usersTable).values({
      name: "Passageiro Teste",
      email: passengerEmail,
      passwordHash: "efb7f9242f510e64101f87d5de8ce7b0d25a5be5136a36d4b653c4feda9c37f4",
      phone: "(11) 98888-0001",
      role: "passenger",
      rating: 4.8,
      totalRides: 12,
    });
  }

  // Test driver: motorista@teste.com / test123
  const driverEmail = "motorista@teste.com";
  const existingDriver = await db.select().from(usersTable).where(eq(usersTable.email, driverEmail));
  if (existingDriver.length === 0) {
    const [testDriver] = await db.insert(usersTable).values({
      name: "Motorista Teste",
      email: driverEmail,
      passwordHash: "efb7f9242f510e64101f87d5de8ce7b0d25a5be5136a36d4b653c4feda9c37f4",
      phone: "(11) 97777-0001",
      role: "driver",
      rating: 4.9,
      totalRides: 45,
    }).returning();

    await db.insert(driverProfilesTable).values({
      userId: testDriver.id,
      status: "approved",
      vehicleMake: "Toyota",
      vehicleModel: "Corolla",
      vehicleYear: 2022,
      vehicleColor: "Prata",
      vehiclePlate: "ABC1D23",
      vehicleType: "sedan",
      cpf: "111.111.111-11",
      cnhNumber: "11111111111",
      cnhCategory: "B",
    });
  }
}
