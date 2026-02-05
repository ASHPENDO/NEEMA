from fastapi import FastAPI

def create_application() -> FastAPI:
    app = FastAPI(title="POSTIKA API")

    @app.get("/")
    def root():
        return {"status": "ok", "service": "postika"}

    return app

app = create_application()
