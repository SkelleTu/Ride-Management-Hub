import { db, usersTable, driverProfilesTable } from "./index";
import { eq } from "drizzle-orm";

export async function seedDefaultAccounts() {
  // Owner: vfdiogoseg@gmail.com / Victor.!.1999
  const ownerEmail = "vfdiogoseg@gmail.com";
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, ownerEmail));

  if (existing.length === 0) {
    const [owner] = await db.insert(usersTable).values({
      name: "Victor Felipe Diogo",
      email: ownerEmail,
      passwordHash: "d9784dd697fa23a4ff8b9d96fb36ac01cc306608e3a06cfef76375b8ee34ab1f",
      phone: "(11) 99999-0001",
      role: "admin",
      avatarUrl: "/avatars/victor.jpg",
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
    // Garantir que a foto esteja sempre atualizada
    if (!owner.avatarUrl) {
      await db.update(usersTable).set({ avatarUrl: "/avatars/victor.jpg" }).where(eq(usersTable.email, ownerEmail));
    }
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

  // João Subdono: joao@upcar.com / joao123
  const joaoEmail = "joao@upcar.com";
  const existingJoao = await db.select().from(usersTable).where(eq(usersTable.email, joaoEmail));
  if (existingJoao.length === 0) {
    await db.insert(usersTable).values({
      name: "João Vitor Bellon",
      email: joaoEmail,
      passwordHash: "81d18ef0d49e17b9b3116ffb46e1cfad2d949e28190de3fa8b0b8627d14d1a5f",
      phone: "(11) 99999-0002",
      role: "passenger",
      avatarUrl: "/avatars/joao.jpg",
      rating: 5.0,
      totalRides: 0,
    });
  } else {
    if (!existingJoao[0].avatarUrl) {
      await db.update(usersTable).set({ avatarUrl: "/avatars/joao.jpg" }).where(eq(usersTable.email, joaoEmail));
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
      rating: 4.6,
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
