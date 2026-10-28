
async function probarConexion() {
    const { data, error } = await db
        .from("servicios")
        .select("*");

    if (error) {
        console.error("Error de conexión:", error.message);
        alert("No se pudieron cargar los servicios.");
        return;
    }

    console.log("Servicios cargados:", data);
    alert("¡Conexión exitosa con Supabase!");
}

probarConexion();
